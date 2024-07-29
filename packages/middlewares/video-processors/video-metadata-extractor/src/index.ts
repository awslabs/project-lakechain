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

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { MediaInfoLayer } from '@project-lakechain/layers/mediainfo';
import { PowerToolsLayer } from '@project-lakechain/layers/powertools';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';

import {
  Middleware,
  MiddlewareBuilder,
  MiddlewareProps,
  LAMBDA_INSIGHTS_VERSION,
  NAMESPACE
} from '@project-lakechain/core/middleware';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'video-metadata-extractor',
  description: 'Extracts the metadata of video files.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(1);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME = lambda.Runtime.PYTHON_3_11;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 256;

/**
 * Builder for the `VideoMetadataExtractor` middleware.
 */
class VideoMetadataExtractorBuilder extends MiddlewareBuilder {

  /**
   * @returns a new instance of the `VideoMetadataExtractor`
   * service constructed with the given parameters.
   */
  public build(): VideoMetadataExtractor {
    return (new VideoMetadataExtractor(
      this.scope,
      this.identifier, {
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to extract metadata from videos
 * using the `libmediainfo` library.
 */
export class VideoMetadataExtractor extends Middleware {

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `VideoMetadataExtractor` service.
   */
  public static readonly Builder = VideoMetadataExtractorBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: MiddlewareProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    // Processing function.
    this.eventProcessor = new lambda.Function(this, 'Compute', {
      description: 'A function extracting metadata from video files.',
      code: lambda.Code.fromAsset(
        path.join(__dirname, 'lambdas', 'metadata-extractor'), {
          bundling: {
            image: lambda.Runtime.PYTHON_3_11.bundlingImage,
            command: [
              'bash', '-c', [
                'pip install -r requirements.txt -t /asset-output',
                'cp -au . /asset-output'
              ].join(' && ')
            ]
          }
      }),
      vpc: this.props.vpc,
      handler: 'index.lambda_handler',
      memorySize: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      runtime: EXECUTION_RUNTIME,
      timeout: PROCESSING_TIMEOUT,
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
        SNS_TARGET_TOPIC: this.eventBus.topicArn
      },
      layers: [
        // Media Info layer.
        MediaInfoLayer.arm64(this, 'MediaInfoLayer'),
        // PowerTools layer.
        PowerToolsLayer.python().arm64(this, 'PowerToolsLayer')
      ]
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 2,
      reportBatchItemFailures: true
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
   * type by the data producer.
   */
  supportedInputTypes(): string[] {
    return ([
      'video/mpeg',
      'video/mp4',
      'video/x-m4v',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/MP2T',
      'video/x-ms-wmv',
      'video/x-flv'
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
