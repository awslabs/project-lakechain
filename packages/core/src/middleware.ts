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

import get from 'lodash/get';

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { z } from 'zod';
import { EventEmitter } from 'events';
import { generateErrorMessage, ErrorMessageOptions } from 'zod-error';
import { Construct } from 'constructs';
import { Service, ServiceDescription } from './service';
import { matchMimeTypes } from './utils/mime-types';
import { ComputeType } from './compute-type';
import { ConditionalStatement, when } from './dsl/vocabulary/conditions';
import { CacheStorage } from './cache-storage';

/**
 * The namespace to be used by middlewares to
 * publish metrics (e.g to AWS CloudWatch).
 */
export const NAMESPACE = 'lakechain';

/**
 * The default lambda insights extension version
 * to use when lambda insights is enabled.
 */
export const LAMBDA_INSIGHTS_VERSION = lambda.LambdaInsightsVersion.VERSION_1_0_135_0;

/**
 * The types that are supported as a middleware input.
 * While most middlewares will always support an SQS topic
 * as an input, and an SNS topic as an output, in some circumstances,
 * such as for specific data connectors, it makes sense to be able
 * to support other AWS services that have a native integration with SNS
 * as an input.
 */
type MiddlewareInput = sqs.IQueue | firehose.CfnDeliveryStream;

/**
 * The schema for a middleware properties.
 */
export const MiddlewarePropsSchema = z.object({

  /**
   * The data sources to plug to this service.
   */
  sources: z.custom<Set<Middleware>>(
    (data) => data instanceof Set
  ),

  /**
   * The data consumers to plug to this service.
   */
  destinations: z.custom<Set<Middleware>>(
    (data) => data instanceof Set
  ),

  /**
   * A map between middlewares and conditional statements
   * to apply on the subscription associated with them.
   */
  conditionals: z.map(z.string(), z.custom<ConditionalStatement>()),

  /**
   * The compute type to use for running the middleware.
   * Note that not all middlewares support both CPU and
   * GPU compute types, and might only support one of
   * the available compute types.
   */
  computeType: z
    .nativeEnum(ComputeType)
    .default(ComputeType.CPU)
    .optional(),

  /**
   * The maximum number of times to retry a failed
   * processing event.
   * @min 0
   * @default 5
   */
  maxRetry: z
    .number()
    .min(0)
    .default(5)
    .optional(),

  /**
   * The visibility timeout to apply to the
   * input SQS queue.
   */
  queueVisibilityTimeout: z
    .custom<cdk.Duration>(
      (data) => data instanceof cdk.Duration
    )
    .default(cdk.Duration.seconds(180))
    .optional(),

  /**
   * The maximum amount of time a middleware will
   * wait before processing a batch of events.
   * @note this a hint to the middleware, and every
   * implementation might not support batching windows.
   * @min 0 seconds
   * @max 300 seconds
   */
  batchingWindow: z
    .custom<cdk.Duration>()
    .refine((data) => data.toSeconds() >= 0 && data.toSeconds() <= 300)
    .optional(),

  /**
   * The number of documents to attempt to process in
   * a single batch by the middleware. The higher this
   * value, the more documents the middleware will attempt
   * to process in parallel.
   * @note this a hint to the middleware, and every
   * implementation might not support batching document
   * processing.
   * @min 1
   * @max 10
   */
  batchSize: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional(),

  /**
   * The number of documents to process in parallel
   * by the middleware.
   * @note this is a hint to the middleware, and every
   * implementation might not support setting a maximum
   * concurrency value.
   * @min 1
   */
  maxConcurrency: z
    .number()
    .int()
    .min(1)
    .optional(),

  /**
   * Whether to enable CloudWatch Insights for the
   * middlewares.
   * @default false
   */
  cloudWatchInsights: z
    .boolean()
    .default(false),

  /**
   * The cache storage to be used by the middleware.
   */
  cacheStorage: z
    .custom<CacheStorage>(
      (data) => data instanceof CacheStorage,
      { message: 'You must provide a cache storage. See withCacheStorage().' }
    ),

  /**
   * The log retention to apply to the middleware.
   * @default 7 days
   */
  logRetention: z
    .custom<logs.RetentionDays>()
    .default(logs.RetentionDays.ONE_WEEK),

  /**
   * The maximum memory size, in megabytes, that
   * the underlying compute is allowed to use.
   * @note this is a hint to the middleware, and
   * every implementation might not support
   * memory size configuration.
   */
  maxMemorySize: z
    .number()
    .int()
    .min(128)
    .optional(),

  /**
   * The KMS key used by the middleware to encrypt
   * data in transit and at rest.
   */
  kmsKey: z
    .custom<kms.IKey>()
    .optional(),

  /**
   * The key reuse period to apply to the
   * SQS queue handling document events.
   * @note Only used when a KMS key is defined.
   * @default 5 minutes
   */
  keyReusePeriod: z
    .custom<cdk.Duration>()
    .default(cdk.Duration.minutes(5)),

  /**
   * An optional VPC in which the resources created
   * by the middleware should be placed.
   */
  vpc: z
    .custom<ec2.IVpc>()
    .optional()
});

// The type of the `MiddlewarePropsSchema` schema.
export type MiddlewareProps = z.infer<typeof MiddlewarePropsSchema>;

/**
 * Abstract middleware builder to be extended by
 * concrete middleware builder implementations.
 */
export abstract class MiddlewareBuilder {

  /**
   * The construct scope.
   */
  protected scope: Construct;

  /**
   * The construct identifier.
   */
  protected identifier: string;

  /**
   * The middleware builder properties.
   */
  protected props: MiddlewareProps;

  /**
   * Builder constructor.
   */
  constructor() {
    this.props              = {} as MiddlewareProps;
    this.props.sources      = new Set<Middleware>();
    this.props.destinations = new Set<Middleware>();
    this.props.conditionals = new Map<string, ConditionalStatement>();
  }

  /**
   * Sets the ingestion construct scope.
   * @param scope the construct scope to assign.
   */
  public withScope(scope: Construct) {
    this.scope = scope;
    return (this);
  }

  /**
   * Sets the construct identifier.
   * @param identifier the construct identifier.
   */
  public withIdentifier(identifier: string) {
    this.identifier = identifier;
    return (this);
  }

  /**
   * Pipes a new data source into this middleware.
   * @param source the data source to pipe.
   */
  public withSource(source: Middleware, condition?: ConditionalStatement) {
    if (condition) {
      this.props.conditionals.set(source.serviceDescription.name, condition);
    }
    this.props.sources.add(source);
    return (this);
  }

  /**
   * Pipes an array of data sources into this middleware.
   * @param sources the data sources to pipe.
   */
  public withSources(sources: Middleware[], condition?: ConditionalStatement) {
    for (const source of sources) {
      this.withSource(source, condition);
    }
    return (this);
  }

  /**
   * Sets the compute type to use for running the
   * middleware.
   * @param computeType the compute type to use.
   * Note that not all middlewares support both CPU
   * and GPU compute types, and might only support
   * one of the available compute types.
   */
  public withComputeType(computeType: ComputeType) {
    this.props.computeType = computeType;
    return (this);
  }

  /**
   * Sets the maximum number of times to retry a failed
   * processing event.
   * @param maxRetry the maximum number of retries.
   * @returns the current builder instance.
   * @default 5
   */
  public withMaxRetry(maxRetry: number) {
    this.props.maxRetry = maxRetry;
    return (this);
  }

  /**
   * Sets the visibility timeout to apply to the
   * input SQS queue.
   * @param queueVisibilityTimeout the visibility timeout duration.
   * @returns the current builder instance.
   * @default 180
   */
  public withQueueVisibilityTimeout(queueVisibilityTimeout: cdk.Duration) {
    this.props.queueVisibilityTimeout = queueVisibilityTimeout;
    return (this);
  }

  /**
   * Pipes a data consumer into the given destination.
   * @param destination the data consumer to pipe.
   */
  public withConsumer(destination: Middleware) {
    this.props.destinations.add(destination);
    return (this);
  }

  /**
   * Pipes an array of data consumers into this middleware.
   * @param consumers the data consumers to pipe.
   */
  public withConsumers(consumers: Middleware[]) {
    for (const consumer of consumers) {
      this.withConsumer(consumer);
    }
    return (this);
  }

  /**
   * Sets the maximum amount of time a middleware will
   * wait before processing a batch of events. This provides
   * a way for middlewares to process documents in batching
   * time windows, instead of one at a time.
   * @note this is a hint to the middleware, and every
   * implementation might not support batching windows.
   * @param batchingWindow the batching window to use.
   * @min 0 seconds
   * @max 300 seconds
   */
  public withBatchingWindow(batchingWindow: cdk.Duration) {
    this.props.batchingWindow = batchingWindow;
    return (this);
  }

  /**
   * Sets the number of documents to attempt to process in
   * a single batch by the middleware. The higher this
   * value, the more documents the middleware will attempt
   * to process in parallel.
   * @note this is a hint to the middleware, and every
   * implementation might not support batching document
   * processing.
   * @param batchSize the batch size to use.
   * @min 1
   * @max 10
   */
  public withBatchSize(batchSize: number) {
    this.props.batchSize = batchSize;
    return (this);
  }

  /**
   * Sets the number of documents to process in parallel
   * by the middleware.
   * @note this is a hint to the middleware, and every
   * implementation might not support setting a maximum
   * concurrency value.
   * @param maxConcurrency the maximum concurrency value.
   * @min 1
   */
  public withMaxConcurrency(maxConcurrency: number) {
    this.props.maxConcurrency = maxConcurrency;
    return (this);
  }

  /**
   * Sets whether to enable CloudWatch Insights for the
   * middleware.
   * @note this is a hint to the middleware, and depending
   * on the underlying compute implementation, the middleware
   * might, ot might not, support CloudWatch Insights.
   * @param cloudWatchInsights whether to enable CloudWatch
   * Insights for the middleware.
   * @default false
   */
  public withCloudWatchInsights(cloudWatchInsights: boolean) {
    this.props.cloudWatchInsights = cloudWatchInsights;
    return (this);
  }

  /**
   * Sets the cache storage of the middleware.
   * The cache storage allows middlewares to store
   * metadata in a way that it is accessible by
   * any other middleware in a pipeline.
   * @param storage the storage instance to use as a cache storage.
   */
  public withCacheStorage(storage: CacheStorage) {
    this.props.cacheStorage = storage;
    return (this);
  }

  /**
   * Sets the log retention to apply to the middleware.
   * @param logRetention the log retention duration.
   * @default 7 days
   */
  public withLogRetention(logRetention: logs.RetentionDays) {
    this.props.logRetention = logRetention;
    return (this);
  }

  /**
   * Sets the maximum memory size, in megabytes, that
   * the underlying compute is allowed to use.
   * @note this is a hint to the middleware, and
   * every implementation might not support
   * memory size configuration.
   * @param maxMemorySize the maximum memory size.
   * @min 128
   */
  public withMaxMemorySize(maxMemorySize: number) {
    this.props.maxMemorySize = maxMemorySize;
    return (this);
  }

  /**
   * Sets the KMS key used by the middleware to encrypt
   * data in transit and at rest.
   * @param kmsKey the KMS key to use.
   */
  public withKmsKey(kmsKey: kms.IKey) {
    this.props.kmsKey = kmsKey;
    return (this);
  }

  /**
   * Sets the key reuse period to apply to the
   * SQS queue handling document events.
   * @note Only used when a KMS key is defined.
   * @param keyReusePeriod the data key reuse period.
   * @default 5 minutes
   */
  public withKeyReusePeriod(keyReusePeriod: cdk.Duration) {
    this.props.keyReusePeriod = keyReusePeriod;
    return (this);
  }

  /**
   * Sets the VPC in which the resources created
   * by the middleware should be placed.
   * @param vpc the VPC to use.
   */
  public withVpc(vpc: ec2.IVpc) {
    this.props.vpc = vpc;
    return (this);
  }

  /**
   * @returns a new instance of the `TextConverter`
   * service constructed with the given parameters.
   */
  public abstract build(): Middleware;
}

/**
 * The `Middleware` abstract class represents a middleware construct
 * that takes an input from an SQS queue, and produces an output
 * to an SNS output topic. This class provides a way to generically
 * define those components and is the base class for all middleware
 * constructs. In addition, this class will take care of exposing the
 * CloudWatch metrics associated with the input and output components.
 *
 * This class extends the `Service` class which provides a base for
 * any micro-service construct and handles operations such as the
 * registration of created micro-services in the parameter store.
 */
export abstract class Middleware extends Service {

  /**
   * The data sources to plug to this service.
   */
  protected sources: Set<Middleware>;

  /**
   * The data consumers to plug to this service.
   */
  protected destinations: Set<Middleware>;

  /**
   * Conditional statements associated with middlewares.
   */
  protected conditionals: Map<string, ConditionalStatement>;

  /**
   * The set of nodes connections connecting this
   * middleware to other middlewares.
   */
  private nodeConnections: Set<string>;

  /**
   * The middleware dead letter queue containing
   * failed events.
   */
  protected deadLetterQueue: sqs.IQueue;

  /**
   * The SQS queue used to receive processing requests.
   */
  protected eventQueue: sqs.IQueue;

  /**
   * The SNS topic to which processing results
   * will be sent.
   */
  protected eventBus: sns.ITopic;

  /**
   * The CloudWatch log group associated with
   * the middleware.
   */
  protected logGroup: logs.ILogGroup;

  /**
   * The IAM principal.
   */
  public grantPrincipal: iam.IPrincipal;

  /**
   * The event emitter carrying events
   * across a pipeline.
   */
  private emitter: EventEmitter;

  /**
   * The middleware properties.
   */
  private mProps: MiddlewareProps;

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param description the service description.
   */
  constructor(scope: Construct, id: string, description: ServiceDescription, props: MiddlewareProps) {
    super(scope, id, description);

    // Parsing the properties.
    this.mProps = this.parse(MiddlewarePropsSchema, props);

    // Create the event emitter.
    this.emitter = new EventEmitter();

    // Save the data sources and consumers.
    this.sources = new Set<Middleware>();
    this.destinations = new Set<Middleware>();
    this.conditionals = this.mProps.conditionals;
    this.nodeConnections = new Set<string>();

    // We verify that the desired compute type is supported
    // by the middleware.
    if (this.mProps.computeType && !this.supportedComputeTypes().includes(this.mProps.computeType)) {
      throw new Error(`The middleware '${this.name()}' does not support the '${this.mProps.computeType}' compute type`);
    }

    // The dead letter queue containing failed events.
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      retentionPeriod: cdk.Duration.days(14),
      encryptionMasterKey: this.mProps.kmsKey,
      encryption: this.mProps.kmsKey ?
        sqs.QueueEncryption.KMS :
        sqs.QueueEncryption.SQS_MANAGED,
      dataKeyReuse: this.mProps.kmsKey ?
        this.mProps.keyReusePeriod :
        undefined,
      enforceSSL: true
    });

    // Creating the processing queue.
    this.eventQueue = new sqs.Queue(this, 'Queue', {
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: this.mProps.queueVisibilityTimeout,
      deadLetterQueue: {
        maxReceiveCount: this.mProps.maxRetry ?? 5,
        queue: this.deadLetterQueue
      },
      encryption: this.mProps.kmsKey ?
        sqs.QueueEncryption.KMS :
        sqs.QueueEncryption.SQS_MANAGED,
      encryptionMasterKey: this.mProps.kmsKey,
      dataKeyReuse: this.mProps.kmsKey ?
        this.mProps.keyReusePeriod :
        undefined,
      enforceSSL: true
    });

    // The SNS topic to which the result will be sent.
    this.eventBus = new sns.Topic(this, 'Topic', {
      masterKey: this.mProps.kmsKey
    });

    // The middleware log group name.
    const logGroupName = this.logGroupName();

    // Creating the log group.
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName,
      encryptionKey: this.mProps.kmsKey,
      retention: this.mProps.logRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // If a KMS key is provided, allow the log group
    // to use the KMS key.
    if (this.mProps.kmsKey) {
      this.mProps.kmsKey.addToResourcePolicy(new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal('logs.amazonaws.com')],
        actions: [
          'kms:Encrypt*',
          'kms:ReEncrypt*',
          'kms:Decrypt*',
          'kms:GenerateDataKey*',
          'kms:Describe*'
        ],
        resources: ['*'],
        conditions: {
          ArnLike: {
            'kms:EncryptionContext:aws:logs:arn': cdk.Arn.format({
              service: 'logs',
              resource: 'log-group',
              resourceName: logGroupName,
              arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
            }, cdk.Stack.of(this.mProps.kmsKey))
          }
        }
      }));
    }

    // Adding properties on the input and output of the middleware
    // in the parameter store.
    this.addProperty('input-queue/url', this.eventQueue.queueUrl);
    this.addProperty('event-bus/arn', this.eventBus.topicArn);
    this.addProperty('log-group/name', this.logGroup.logGroupName);
  }

  /**
   * This helper generates a unique log group name for this
   * particular middleware instance. This unified log group is
   * used across all components of the middleware to centralize
   * logs in a single log group.
   * @returns the log group name associated with this
   * middleware instance.
   */
  protected logGroupName() {
    const stackName = cdk.Stack.of(this).stackName;
    return (`/lakechain/${stackName}/middlewares/${this.name()}/${this.node.addr}`);
  }

  /**
   * @returns the data sources plugged to this
   * middleware.
   */
  public getSources(): Set<Middleware> {
    return (this.sources);
  }

  /**
   * @returns the data consumers plugged to this
   * middleware.
   */
  public getConsumers(): Set<Middleware> {
    return (this.destinations);
  }

  /**
   * @returns the consumer SQS queue which will be
   * used by the data consumer to ingest processing
   * requests.
   */
  public getQueue(): sqs.IQueue {
    return (this.eventQueue);
  }

  /**
   * @returns the dead letter queue containing failed
   * events.
   */
  public getDeadLetterQueue(): sqs.IQueue {
    return (this.deadLetterQueue);
  }

  /**
   * @returns the output SNS topic to which processed
   * events are sent.
   */
  public getEventBus(): sns.ITopic {
    return (this.eventBus);
  }

  /**
   * @returns the effective input of the middleware.
   * This method can be overridden by middlewares that
   * don't use SQS as an input.
   */
  public getInput(): MiddlewareInput {
    return (this.getQueue());
  }

  /**
   * @returns the log group associated with the middleware.
   * This log group is used by middlewares to consolidate
   * logs from different components in a single log group.
   */
  public getLogGroup(): logs.ILogGroup {
    return (this.logGroup);
  }

  /**
   * @param mimeTypes a list of mime-types to analyze.
   * @returns whether any of the given mime-types contain
   * a placeholder value that would match any mime-type.
   */
  private containsPlaceholder(mimeTypes: string[]) {
    return (mimeTypes
      .filter((mimeType) => mimeType === '*' || mimeType === '*/*')
      .length > 0
    );
  }

  /**
   * An internal helper to connect the current middleware's output topic
   * to the given SQS queue.
   * @param queue the SQS queue to connect to.
   * @param conditional the conditional statement to apply on the
   * subscription.
   * @returns the current middleware instance.
   */
  private pipeToSqsQueue(queue: sqs.IQueue, conditional: ConditionalStatement): this {
    // The subscription identifier.
    const id = `${cdk.Names.nodeUniqueId(this.eventBus.node)}-${cdk.Names.nodeUniqueId(queue.node)}`;

    // If the current middleware is already connected to the
    // given queue, we skip the connection.
    if (this.nodeConnections.has(id)) {
      return (this);
    }

    // Add a resource policy on the target SQS queue, allowing
    // the SNS topic to publish messages to the queue.
    queue.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('sns.amazonaws.com')],
      actions: ['sqs:SendMessage'],
      resources: [queue.queueArn],
      conditions: {
        ArnEquals: { 'aws:SourceArn': this.eventBus.topicArn }
      }
    }));

    // If the target SQS queue is encrypted, we need to allow
    // the SNS topic to publish encrypted messages to the queue.
    if (queue.encryptionMasterKey) {
      queue.encryptionMasterKey.addToResourcePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('sns.amazonaws.com')],
        actions: [
          'kms:Decrypt',
          'kms:GenerateDataKey*'
        ],
        resources: ['*']
      }));
    }

    // The subscription between the output SNS topic of this middleware,
    // and the input SQS queue of the target middleware.
    new sns.CfnSubscription(this, id, {
      protocol: 'sqs',
      topicArn: this.eventBus.topicArn,
      endpoint: queue.queueArn,
      filterPolicyScope: 'MessageBody',
      filterPolicy: conditional.value(),
      rawMessageDelivery: true
    });

    // Mark the connection as established.
    this.nodeConnections.add(id);

    return (this);
  }

  /**
   * An internal helper to connect the current middleware's output topic
   * to the given Kinesis Firehose stream.
   * @param stream the Kinesis Firehose stream to connect to.
   * @param conditional the conditional statement to apply on the
   * subscription.
   * @returns the current middleware instance.
   */
  private pipeToFirehoseStream(stream: firehose.CfnDeliveryStream, conditional: ConditionalStatement): this {
    // The subscription identifier.
    const id = `${cdk.Names.nodeUniqueId(this.eventBus.node)}-${cdk.Names.nodeUniqueId(stream.node)}`;
    
    // If the current middleware is already connected to the
    // given stream, we skip the connection.
    if (this.nodeConnections.has(id)) {
      return (this);
    }

    // The subscription role.
    const subscriptionRole = new iam.Role(this, `FirehoseSubscription-${id}`, {
      assumedBy: new iam.ServicePrincipal('sns.amazonaws.com')
    });

    // Allow the role to publish to the Firehose delivery stream.
    subscriptionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'firehose:DescribeDeliveryStream',
        'firehose:ListDeliveryStreams',
        'firehose:ListTagsForDeliveryStream',
        'firehose:PutRecord',
        'firehose:PutRecordBatch'
      ],
      resources: [stream.attrArn]
    }));

    // The subscription between the output SNS topic of this middleware,
    // and the input SQS queue of the target middleware.
    new sns.CfnSubscription(this, id, {
      protocol: 'firehose',
      topicArn: this.eventBus.topicArn,
      endpoint: stream.attrArn,
      filterPolicyScope: 'MessageBody',
      filterPolicy: conditional.value(),
      rawMessageDelivery: true,
      subscriptionRoleArn: subscriptionRole.roleArn
    });

    // Mark the connection as established.
    this.nodeConnections.add(id);

    return (this);
  }

  /**
   * Pipes documents from this middleware to a data consumer.
   * @param consumer the data consumer to pipe documents to.
   * @param conditional the conditional statement to apply on the
   * subscription.
   */
  public pipe(consumer: Middleware, conditional: ConditionalStatement = consumer.conditional()): Middleware {
    const output = consumer.getInput();

    // Verifying whether the supported output types for this middleware
    // are compatible with the supported input types of the destination.
    if (!matchMimeTypes(this.supportedOutputTypes(), consumer.supportedInputTypes())) {
      throw new Error(`'${this.name()}' is not compatible with '${consumer.name()}'`);
    }

    const types = get(conditional.value(), 'data.document.type');

    if (!types) {
      // If the subscription does not include supported input mime-types,
      // we want as a precaution, to add the supported input mime-types in
      // the condition to ensure the target middleware is not spawned unnecessarily.
      // If users want to override the supported input mime-types, they can provide
      // an explicit reference in the user-provided condition.
      if (!this.containsPlaceholder(consumer.supportedInputTypes())) {
        conditional.and(
          when('data.document.type').includes(...consumer.supportedInputTypes())
        );
      }
    }

    // Connect the output of this middleware to the input of the
    // target middleware.
    if (output instanceof sqs.Queue) {
      this.pipeToSqsQueue(output, conditional);
    } else if (output instanceof firehose.CfnDeliveryStream) {
      this.pipeToFirehoseStream(output, conditional);
    }

    // Allow the consumer to read the documents produced
    // by this middleware.
    if (consumer.grantPrincipal) {
      this.grantReadProcessedDocuments(consumer);
    }

    // Callbacks to notify the middlewares when a new
    // source or consumer is added.
    this.onConsumerAdded(consumer);
    consumer.onSourceAdded(this);

    return (consumer);
  }

  /**
   * The `conditional` allows middlewares to define a complex conditional
   * statement defining when their middleware can accept messages from
   * other middlewares.
   * @returns the default conditional statement for a middleware.
   */
  public conditional() {
    if (this.containsPlaceholder(this.supportedInputTypes())) {
      // If the middleware supports all mime-types as an input, we
      // return an empty conditional statement, allowing any
      // document to be passed to this middleware.
      return (ConditionalStatement.empty());
    }
    return (
      when('data.document.type')
        .includes(...this.supportedInputTypes())
    );
  }

  /**
   * An internal helper allowing to validate schemas using a
   * predefined visualization for error messages.
   * @param schema the Zod schema to use to validate the properties.
   * @param opts the options to validate.
   * @returns the parsed properties.
   */
  protected parse<
    Props extends MiddlewareProps
  >(schema: z.ZodSchema, opts: Props): Props {
    const options: ErrorMessageOptions = {
      delimiter: {
        component: ' - ',
      },
      path: {
        enabled: true,
        type: 'zodPathArray',
        label: 'Path: ',
      },
      code: {
        enabled: false
      },
      message: {
        enabled: true,
        label: '',
      },
      transform: ({ errorMessage, index }) => {
        return (`❗ ${this.name()} - Error #${index + 1}: ${errorMessage}`);
      }
    };

    const result = schema.safeParse(opts);
    if (!result.success) {
      throw new Error(generateErrorMessage(result.error.issues, options));
    }
    return (result.data as Props);
  }

  /**
   * An internal event handler called back when
   * a new middleware is added as a source to
   * this middleware.
   * @param source the middleware being added.
   */
  protected onSourceAdded(source: Middleware) {
    if (!this.sources.has(source)) {
      this.sources.add(source);
      setImmediate(() => this.emit('source-added', source));
    }
  }

  /**
   * An internal event handler called back when
   * a new middleware is added as a consumer to
   * this middleware.
   * @param consumer the middleware being added.
   */
  protected onConsumerAdded(consumer: Middleware) {
    if (!this.destinations.has(consumer)) {
      this.destinations.add(consumer);
      setImmediate(() => this.emit('consumer-added', consumer));
    }
  }

  protected bind() {
    // Binding data sources to this service.
    for (const source of this.mProps.sources) {
      source.pipe(this, this.conditionals.get(source.serviceDescription.name));
    }

    // Binding this service to data destinations.
    for (const destination of this.mProps.destinations) {
      this.pipe(destination, this.conditionals.get(destination.serviceDescription.name));
    }

    // Granting the middleware the ability to read
    // and write from the processed documents generated by
    // the previous middleware.
    if (this.grantPrincipal) {
      this.mProps.cacheStorage.getBucket().grantRead(this.grantPrincipal);
      this.mProps.cacheStorage.getBucket().grantWrite(this.grantPrincipal, `${this.name()}/*`);
      
      // If a KMS key is defined, we grant the middleware
      // the ability to encrypt and decrypt data using
      // the KMS key.
      if (this.mProps.kmsKey) {
        this.mProps.kmsKey.grantEncryptDecrypt(this.grantPrincipal);
      }
    }
  }

  /**
   * Allows developers to subscribe to events
   * emitted by this middleware.
   * @param event the event to subscribe to.
   * @param listener the callback to invoke when
   * the event is emitted.
   * @returns the current middleware instance.
   */
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.on(event, listener);
    return (this);
  }

  /**
   * Allows developers to subscribe to events
   * emitted by this middleware only once.
   * @param event the event to subscribe to.
   * @param listener the callback to invoke when
   * the event is emitted.
   * @returns the current middleware instance.
   */
  public once(event: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.once(event, listener);
    return (this);
  }

  /**
   * Emits an event to all the listeners subscribed
   * to the given event.
   * @param event the event to emit.
   * @param args the arguments to pass to the listeners.
   * @returns `true` if the event had listeners, `false`
   * otherwise.
   */
  public emit(event: string | symbol, ...args: any[]): boolean {
    return (this.emitter.emit(event, ...args));
  }

  /**
   * Allows developers to unsubscribe from events
   * emitted by this middleware.
   * @param event the event to unsubscribe from.
   * @param listener the callback associated with the
   * event.
   * @returns the current middleware instance.
   */
  public off(event: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.off(event, listener);
    return (this);
  }

  /**
   * This method can be used by developers to dump
   * the current state of the middleware.
   * @returns a developer friendly string providing information
   * about the middleware.
   */
  public toString(): string {
    return (`[${this.name()}@${this.description.version}] - ${this.description.description}
      ${this.sources.size} Sources - ${this.destinations.size} Consumers
    `);
  }

  /**
   * @param props optional metric properties.
   * @returns a CloudWatch metric tracking the amount
   * of messages in flight in the event queue.
   */
  public metricInFlightMessages(props: cloudwatch.MetricOptions = {}) {
    return (this.eventQueue.metricApproximateNumberOfMessagesVisible(props));
  }

  /**
   * @param props optional metric properties.
   * @returns a CloudWatch metric tracking the amount
   * of messages in the dead letter queue.
   */
  public metricDeadLetterQueueMessages(props: cloudwatch.MetricOptions = {}) {
    return (this.deadLetterQueue.metricApproximateNumberOfMessagesVisible(props));
  }

  /**
   * @param props optional metric properties.
   * @returns a CloudWatch metric tracking the amount
   * of messages published to other middlewares.
   */
  public metricPublishedMessages(props: cloudwatch.MetricOptions = {}) {
    return (this.eventBus.metricNumberOfMessagesPublished(props));
  }

  /**
   * @param props optional metric properties.
   * @returns a CloudWatch metric tracking the amount
   * of messages delivered to other middlewares.
   */
  public metricDeliveredMessages(props: cloudwatch.MetricOptions = {}) {
    return (this.eventBus.metricNumberOfNotificationsDelivered(props));
  }

  /**
   * @param props optional metric properties.
   * @returns a CloudWatch metric tracking the amount
   * of messages failed to be delivered to other middlewares.
   */
  public metricFailedMessages(props: cloudwatch.MetricOptions = {}) {
    return (this.eventBus.metricNumberOfNotificationsFailed(props));
  }

  /**
   * @returns the name of the middleware.
   */
  public name(): string {
    return (this.description.name);
  }

  /**
   * @returns the supported input types.
   */
  abstract supportedInputTypes(): string[];

  /**
   * @returns the supported output types.
   */
  abstract supportedOutputTypes(): string[];

  /**
   * @returns the supported compute types by a given
   * middleware.
   */
  abstract supportedComputeTypes(): ComputeType[];

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  abstract grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant;
}
