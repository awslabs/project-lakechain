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
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { PandocTextConverterProps, PandocTextConverterPropsSchema } from './definitions/opts';
import { PandocConversionOps } from './definitions';

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
  name: 'pandoc-text-converter',
  description: 'Converts text-oriented documents using pandoc.',
  version: '0.9.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(5);

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 512;

/**
 * The builder for the `PandocTextConverter` service.
 */
class PandocTextConverterBuilder extends MiddlewareBuilder {
  private providerProps: Partial<PandocTextConverterProps> = {
    mapping: {}
  };

  /**
   * Specifies the list of conversion mappings to apply
   * when converting documents.
   * @param ops the conversion operations.
   * @returns the builder itself.
   */
  public withConversions(...ops: Array<PandocConversionOps>) {
    for (const op of ops) {
      this.providerProps.mapping![op.from] = {
        to: op.to,
        options: op.options
      };
    }
    return (this);
  }

  /**
   * @returns a new instance of the `TextConverter`
   * service constructed with the given parameters.
   */
  public build(): PandocTextConverter {
    return (new PandocTextConverter(
      this.scope,
      this.identifier, {
        ...this.providerProps as PandocTextConverterProps,
        ...this.props
      }
    ));
  }
}

/**
 * Converts text-oriented documents into plain text.
 */
export class PandocTextConverter extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `PandocTextConverter` service.
   */
  public static readonly Builder = PandocTextConverterBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: PandocTextConverterProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = PandocTextConverterPropsSchema.parse(props);

    ///////////////////////////////////////////
    ////////    Processing Storage      ///////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: props.kmsKey
    });

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new lambda.DockerImageFunction(this, 'TextConverter', {
      description: 'Middleware converting text documents using pandoc.',
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, 'lambdas', 'text-converter')
      ),
      vpc: this.props.vpc,
      memorySize: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      architecture: lambda.Architecture.X86_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: this.props.kmsKey,
      logGroup: this.logGroup,
      insightsVersion: this.props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      ephemeralStorageSize: cdk.Size.gibibytes(5),
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        PROCESSED_FILES_BUCKET: this.storage.id(),
        CONVERSION_MAPPING: JSON.stringify(this.props.mapping ?? {})
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 5,
      reportBatchItemFailures: true
    }));

    // Function permissions.
    this.storage.grantWrite(this.eventProcessor);
    this.eventBus.grantPublish(this.eventProcessor);

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
      // Books files.
      'application/epub+zip',
      // CSV files.
      'text/csv',
      // TSV files.
      'text/tab-separated-values',
      // Word files.
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Markdown files.
      'text/markdown',
      // HTML files.
      'text/html',
      // OpenOffice files.
      'application/vnd.oasis.opendocument.text',
      // RTF files.
      'application/rtf',
      // LaTeX files.
      'application/x-tex',
      // RST files.
      'text/x-rst',
      // Textile files.
      'text/x-textile',
      // Jupyter Notebook files.
      'application/x-ipynb+json',
      // Man files.
      'text/troff',
      // JSON files.
      'application/json',
      // BibTex files.
      'application/x-bibtex',
      // Docbook files.
      'application/docbook+xml',
      // FictionBook files.
      'application/x-fictionbook+xml',
      // OPML files.
      'text/x-opml',
      // Texinfo files.
      'application/x-texinfo'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      // Asciidoc files.
      'text/x-asciidoc',
      // BibTex files.
      'application/x-bibtex',
      // Docbook files.
      'application/docbook+xml',
      // Docx files.
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Epub files.
      'application/epub+zip',
      // FictionBook files.
      'application/x-fictionbook+xml',
      // Haskell files.
      'text/x-haskell',
      // HTML files.
      'text/html',
      // XML files.
      'application/xml',
      // Jupyter Notebook files.
      'application/x-ipynb+json',
      // JSON files.
      'application/json',
      // Tex files.
      'application/x-tex',
      // Troff files.
      'text/troff',
      // Markdown files.
      'text/markdown',
      // Plain text files.
      'text/plain',
      // OpenOffice files.
      'application/vnd.oasis.opendocument.text',
      // OPML files.
      'text/x-opml',
      // PDF files.
      'application/pdf',
      // PowerPoint files.
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // RST files.
      'text/x-rst',
      // RTF files.
      'application/rtf',
      // Texinfo files.
      'application/x-texinfo',
      // Textile files.
      'text/x-textile'
    ]);
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

export { from } from './definitions';