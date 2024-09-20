/*
 * Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { BASE_IMAGE_INPUTS, BASE_TEXT_INPUTS } from './definitions/types';

import {
  SemanticOntologyExtractorProps,
  SemanticOntologyExtractorPropsSchema
} from './definitions/opts';
import {
  CustomOntologyClassifier,
  DefaultOntologyClassifier
} from './definitions/classifiers';
import {
  Middleware,
  MiddlewareBuilder,
  LAMBDA_INSIGHTS_VERSION,
  NAMESPACE
} from '@project-lakechain/core/middleware';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'semantic-ontology-extractor',
  description: 'Extracts semantic ontology from processed documents.',
  version: '0.10.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(3);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 256;

/**
 * The default Bedrock model to use for ontology extraction.
 */
const DEFAULT_MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0';

/**
 * The builder for the `SemanticOntologyExtractor` service.
 */
class SemanticOntologyExtractorBuilder extends MiddlewareBuilder {
  private middlewareProps: Partial<SemanticOntologyExtractorProps> = {};

  /**
   * Sets the AWS region in which the model
   * will be invoked.
   * @param region the AWS region in which the model
   * will be invoked.
   * @returns the current builder instance.
   */
  public withRegion(region: string) {
    this.middlewareProps.region = region;
    return (this);
  }

  /**
   * Sets the ontology classifier to use to extract
   * semantic ontology from documents.
   * @param ontologyClassifier the ontology classifier to use.
   * @returns the current builder instance.
   */
  public withOntologyClassifier(ontologyClassifier: DefaultOntologyClassifier | CustomOntologyClassifier) {
    this.middlewareProps.ontologyClassifier = ontologyClassifier;
    return (this);
  }

  /**
   * @returns a new instance of the `SemanticOntologyExtractor`
   * service constructed with the given parameters.
   */
  public build(): SemanticOntologyExtractor {
    return (new SemanticOntologyExtractor(
      this.scope,
      this.identifier, {
        ...this.middlewareProps as SemanticOntologyExtractorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service extracting semantic ontology from processed documents.
 */
export class SemanticOntologyExtractor extends Middleware {

  /**
   * The data processor lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `SemanticOntologyExtractor` service.
   */
  public static readonly Builder = SemanticOntologyExtractorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: SemanticOntologyExtractorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        2 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(SemanticOntologyExtractorPropsSchema, props);

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Extracts semantic ontology from processed documents.',
      entry: path.resolve(__dirname, 'lambdas', 'handler', 'index.js'),
      vpc: this.props.vpc,
      memorySize: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: this.props.kmsKey,
      logGroup: this.logGroup,
      insightsVersion: this.props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        LAKECHAIN_CACHE_STORAGE: this.props.cacheStorage.id(),
        BEDROCK_REGION: this.props.region ?? cdk.Aws.REGION,
        MODEL_ID: DEFAULT_MODEL_ID,
        ONTOLOGY_CLASSIFIER_PROPS: JSON.stringify(
          this.props.ontologyClassifier
        )
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-sns'
        ]
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 1,
      maxConcurrency: 3,
      reportBatchItemFailures: true
    }));

    // Allow access to the Bedrock API.
    this.eventProcessor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [
        `arn:${cdk.Aws.PARTITION}:bedrock:${this.props.region ?? cdk.Aws.REGION}::foundation-model/*`,
      ]
    }));

    // Grant the compute type permissions to
    // publish to the SNS topic.
    this.eventBus.grantPublish(this.grantPrincipal);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    // Since this middleware simply passes through the data
    // from the previous middleware, we grant any subsequent
    // middlewares in the pipeline read access to the
    // data of all source middlewares.
    for (const source of this.sources) {
      source.grantReadProcessedDocuments(grantee);
    }
    return ({} as iam.Grant);
  }

  /**
   * @returns an array of mime-types supported as input
   * type by this middleware.
   */
  supportedInputTypes(): string[] {
    return ([
      ...BASE_TEXT_INPUTS,
      ...BASE_IMAGE_INPUTS
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return (this.supportedInputTypes());
  }

  /**
   * @returns the supported compute types by a given
   * middleware.
   */
  supportedComputeTypes(): ComputeType[] {
    return ([
      ComputeType.CPU
    ]);
  }

  /**
   * @returns the middleware conditional statement defining
   * in which conditions this middleware should be executed.
   * In this case, we want the middleware to only be invoked
   * when the document mime-type is supported, and the event
   * type is `document-created`.
   */
  conditional() {
    return (super
      .conditional()
      .and(when('type').equals('document-created'))
    );
  }
}

export { DefaultOntologyClassifier } from './definitions/classifiers/default-ontology-classifier';
export { CustomOntologyClassifier } from './definitions/classifiers/custom-ontology-classifier';
