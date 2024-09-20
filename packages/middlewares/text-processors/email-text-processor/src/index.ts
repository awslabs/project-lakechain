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
import { CacheStorage } from '@project-lakechain/core';
import { EmailTextProcessorProps, EmailTextProcessorPropsSchema } from './definitions/opts';
import { OutputFormat } from './definitions/output-format';
import { PowerToolsLayer } from '@project-lakechain/layers/powertools';
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
  name: 'email-text-processor',
  description: 'Transforms e-mail documents into different output formats.',
  version: '0.10.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT    = cdk.Duration.minutes(1);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME     = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE   = 256;

/**
 * The builder class for the `EmailTextProcessor` service.
 */
class EmailTextProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<EmailTextProcessorProps> = {};

  /**
   * Sets the desired output format.
   * @param outputFormat the desired output format.
   * @default text
   * @returns the builder instance.
   */
  public withOutputFormat(outputFormat: OutputFormat) {
    this.providerProps.outputFormat = outputFormat;
    return (this);
  }

  /**
   * Sets whether to include attachments.
   * @param includeAttachments whether to include attachments.
   * @default false
   * @returns the builder instance.
   */
  public withIncludeAttachments(includeAttachments: boolean) {
    this.providerProps.includeAttachments = includeAttachments;
    return (this);
  }

  /**
   * Sets whether to include CID attachments to data URL images.
   * @param includeImageLinks whether to include image links.
   * @default false
   * @returns the builder instance.
   */
  public withIncludeImageLinks(includeImageLinks: boolean) {
    this.providerProps.includeImageLinks = includeImageLinks;
    return (this);
  }

  /**
   * @returns a new instance of the `EmailTextProcessor`
   * service constructed with the given parameters.
   */
  public build(): EmailTextProcessor {
    return (new EmailTextProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as EmailTextProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to convert e-mail documents
 * into different output formats.
 */
export class EmailTextProcessor extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `EmailTextProcessor` service.
   */
  public static readonly Builder = EmailTextProcessorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: EmailTextProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(EmailTextProcessorPropsSchema, props);

    ///////////////////////////////////////////
    /////////    Processing Storage      //////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Compute', {
      description: 'Middleware converting e-mail documents into different output formats.',
      entry: path.resolve(__dirname, 'lambdas', 'parser', 'index.js'),
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
        OUTPUT_FORMAT: this.props.outputFormat,
        INCLUDE_ATTACHMENTS: this.props.includeAttachments ? 'true' : 'false',
        INCLUDE_IMAGE_LINKS: this.props.includeImageLinks ? 'true' : 'false'
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-sns',
          '@aws-lambda-powertools/batch',
          '@aws-lambda-powertools/logger',
          '@aws-lambda-powertools/metrics',
          '@aws-lambda-powertools/tracer'
        ]
      },
      layers: [
        PowerToolsLayer
          .typescript()
          .layer(this, 'PowerToolsLayer')
      ]
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.processor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 1,
      reportBatchItemFailures: true
    }));

    // Function permissions.
    this.storage.grantWrite(this.processor);
    this.eventBus.grantPublish(this.processor);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    return (this.storage.grantRead(grantee));
  }

  /**
   * @returns an array of mime-types supported as input
   * type by this middleware.
   */
  supportedInputTypes(): string[] {
    return ([
      'message/rfc822',
      'application/vnd.ms-outlook'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    if (this.props.includeAttachments) {
      return (['*/*']);
    }
    if (this.props.outputFormat === 'text') {
      return (['text/plain']);
    } else if (this.props.outputFormat === 'html') {
      return (['text/html']);
    } else {
      return (['application/json']);
    }
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

export { OutputFormat } from './definitions/output-format';