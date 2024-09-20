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
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as r from '@project-lakechain/core/dsl/vocabulary/reference';

import { z } from 'zod';
import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Model } from './definitions/model';

import {
  ModelParameters,
  StructuredEntityExtractorProps,
  StructuredEntityExtractorPropsSchema
} from './definitions/opts';
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
  name: 'structured-entity-extractor',
  description: 'Extracts structured entities from processed documents.',
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
 * The builder for the `StructuredEntityExtractor` service.
 */
class StructuredEntityExtractorBuilder extends MiddlewareBuilder {
  private middlewareProps: Partial<StructuredEntityExtractorProps> = {};

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
   * Sets the schema to use to extract structured
   * entities from documents.
   * @param schema the schema to use to extract structured
   * entities from documents.
   * @returns the current builder instance.
   */
  public withSchema(schema: z.ZodSchema<any>) {
    this.middlewareProps.schema = schema;
    return (this);
  }

  /**
   * Sets the output type of the structured entities.
   * @param outputType the output type of the structured entities.
   * @returns the current builder instance.
   * @default 'json'
   */
  public withOutputType(outputType: 'json' | 'metadata') {
    this.middlewareProps.outputType = outputType;
    return (this);
  }

  /**
   * Sets the model to use for structured entity extraction.
   * @param model the model to use for structured entity extraction.
   * @returns the current builder instance.
   * @default 'anthropic.claude-3-sonnet-20240229-v1:0'
   */
  public withModel(model: Model) {
    this.middlewareProps.model = model;
    return (this);
  }

  /**
   * Sets optional instruction to pass to the model to guide it
   * in extracting structured entities.
   * @param instructions optional instruction to pass to the model to guide it
   * in extracting structured entities.
   * @returns the current builder instance.
   */
  public withInstructions(instructions: string) {
    this.middlewareProps.instructions = instructions;
    return (this);
  }

  /**
   * Sets the parameters to pass to the text model.
   * @param parameters the parameters to pass to the text model.
   * @default {}
   * @returns the current builder instance.
   */
  public withModelParameters(parameters: ModelParameters) {
    this.middlewareProps.modelParameters = parameters;
    return (this);
  }

  /**
   * @returns a new instance of the `StructuredEntityExtractor`
   * service constructed with the given parameters.
   */
  public build(): StructuredEntityExtractor {
    return (new StructuredEntityExtractor(
      this.scope,
      this.identifier, {
        ...this.middlewareProps as StructuredEntityExtractorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service extracting structured data from documents.
 */
export class StructuredEntityExtractor extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `StructuredEntityExtractor` service.
   */
  public static readonly Builder = StructuredEntityExtractorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: StructuredEntityExtractorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        2 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(StructuredEntityExtractorPropsSchema, props);

    ///////////////////////////////////////////
    ////////    Processing Storage      ///////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: props.kmsKey
    });

    ///////////////////////////////////////////
    //////////    Schema Handler      /////////
    ///////////////////////////////////////////

    // Convert the Zod schema to a JSON schema.
    const jsonSchema = zodToJsonSchema(this.props.schema) as any;

    // Stringified JSON schema.
    const schema = JSON.stringify(jsonSchema);

    // Ensure the root schema is an object.
    if (jsonSchema.type !== 'object') {
      throw new Error(`
        The root schema you provide must be of type 'object'.
      `);
    }

    // Create a reference to the schema.
    let reference: r.IReference<any> = r.reference(r.value(schema));

    // If the schema is bigger than a certain threshold, we upload the schema
    // to the internal storage and reference it in the lambda environment.
    if (schema.length > 3072) {
      new s3deploy.BucketDeployment(this, 'Schema', {
        sources: [s3deploy.Source.data('schema', schema)],
        destinationBucket: this.storage.getBucket()
      });
      reference = r.reference(r.url(`s3://${this.storage.getBucket().bucketName}/schema`));
    }

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Extracts structured entities from processed documents.',
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
        PROCESSED_FILES_BUCKET: this.storage.id(),
        LAKECHAIN_CACHE_STORAGE: this.props.cacheStorage.id(),
        BEDROCK_REGION: this.props.region ?? cdk.Aws.REGION,
        MODEL_ID: this.props.model,
        SCHEMA: JSON.stringify(reference),
        OUTPUT_TYPE: this.props.outputType,
        INSTRUCTIONS: this.props.instructions ?? '',
        MODEL_PARAMETERS: JSON.stringify(this.props.modelParameters)
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
      maxConcurrency: this.props.maxConcurrency ?? 3,
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

    // Grant the compute type permissions to
    // write to the storage.
    this.storage.grantWrite(this.grantPrincipal);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    if (this.props.outputType === 'json') {
      return (this.storage.grantRead(grantee));
    } else {
      // Since this middleware simply passes through the data
      // from the previous middleware, we grant any subsequent
      // middlewares in the pipeline read access to the
      // data of all source middlewares.
      for (const source of this.sources) {
        source.grantReadProcessedDocuments(grantee);
      }
      return ({} as iam.Grant);
    }
  }

  /**
   * @returns an array of mime-types supported as input
   * type by this middleware.
   */
  supportedInputTypes(): string[] {
    return ([
      'text/plain',
      'text/markdown',
      'text/csv',
      'text/html',
      'application/x-subrip',
      'text/vtt',
      'application/json',
      'application/xml',
      'application/cloudevents+json'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return (this.props.outputType === 'json' ?
      ['application/json'] :
      this.supportedInputTypes()
    );
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
