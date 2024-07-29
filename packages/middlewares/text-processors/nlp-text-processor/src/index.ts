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
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { LAMBDA_INSIGHTS_VERSION, Middleware, MiddlewareBuilder, NAMESPACE } from '@project-lakechain/core/middleware';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { Intent } from '@project-lakechain/core/dsl/intent';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { NlpTextProcessorProps, NlpTextProcessorPropsSchema } from './definitions/opts';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'nlp-text-processor',
  description: 'Extracts features from text documents using natural language processing.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(2);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 512;

/**
 * Builder for the `NlpTextProcessor` middleware.
 */
class NlpTextProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<NlpTextProcessorProps> = {};

  /**
   * @param intent the NLP intent to apply.
   */
  public withIntent(intent: Intent) {
    this.providerProps.intent = intent;
    return (this);
  }

  /**
   * @returns a new instance of the `NlpTextProcessor`
   * service constructed with the given parameters.
   */
  public build(): NlpTextProcessor {
    return (new NlpTextProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as NlpTextProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware that expects plain text input documents
 * and which will use different NLP models to extract
 * metadata from the text.
 */
export class NlpTextProcessor extends Middleware {

  /**
   * The data processor lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `NlpTextProcessor` service.
   */
  public static readonly Builder = NlpTextProcessorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: NlpTextProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(NlpTextProcessorPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Applies NLP operations on text documents.',
      entry: path.resolve(__dirname, 'lambdas', 'nlp-processor', 'index.js'),
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
        NLP_OPS: this.props.intent.compile()
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-sns',
          '@aws-sdk/client-comprehend'
        ]
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 2,
      maxConcurrency: 5,
      reportBatchItemFailures: true
    }));

    // Allowing the function to call Amazon Comprehend.
    this.eventProcessor.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'comprehend:DetectDominantLanguage',
        'comprehend:DetectEntities',
        'comprehend:DetectSentiment',
        'comprehend:DetectSyntax',
        'comprehend:DetectPiiEntities'
      ],
      resources: ['*']
    }));

    // Function permissions.
    this.eventBus.grantPublish(this.eventProcessor);

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
      'text/plain',
      'text/html',
      'text/markdown',
      'text/csv',
      'text/xml',
      'application/json'
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

export * as dsl from './definitions/index';