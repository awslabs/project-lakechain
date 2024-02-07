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

import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { Middleware, MiddlewareBuilder } from '@project-lakechain/core/middleware';

import {
  IndexRotationPeriod,
  OpenSearchStorageConnectorProps,
  OpenSearchStorageConnectorPropsSchema
} from './definitions/opts';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'opensearch-storage-connector',
  description: 'Stores document metadata in an OpenSearch cluster.',
  version: '0.1.0',
  attrs: {}
};

/**
 * Builder for the `OpenSearchStorageConnector` service.
 */
class OpenSearchStorageConnectorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<OpenSearchStorageConnectorProps> = {};

  /**
   * Specifies the OpenSearch domain to use.
   */
  public withDomain(domain: opensearch.Domain) {
    this.providerProps.domain = domain;
    return (this);
  }

  /**
   * Specifies the name of the index to use.
   * @param index the name of the index.
   * @returns the current builder instance.
   */
  public withIndexName(index: string) {
    this.providerProps.index = index;
    return (this);
  }

  /**
   * Specifies buffering hints to apply on the Firehose
   * delivery stream.
   * @param hints the buffering hints.
   * @returns the current builder instance.
   */
  public withBufferingHints(hints: firehose.CfnDeliveryStream.BufferingHintsProperty) {
    this.providerProps.bufferingHints = hints;
    return (this);
  }

  /**
   * Specifies the index rotation period to apply
   * when inserting data in OpenSearch.
   * @param period the index rotation period.
   * @returns the current builder instance.
   */
  public withIndexRotationPeriod(period: IndexRotationPeriod) {
    this.providerProps.indexRotationPeriod = period;
    return (this);
  }

  /**
   * @returns a new instance of the `OpenSearchStorageConnector`
   * service constructed with the given parameters.
   */
  public build(): OpenSearchStorageConnector {
    return (new OpenSearchStorageConnector(
      this.scope,
      this.identifier, {
        ...this.providerProps as OpenSearchStorageConnectorProps,
        ...this.props
      }
    ));
  }
}

/**
 * Forwards document events to an OpenSearch index.
 */
export class OpenSearchStorageConnector extends Middleware {

  /**
   * The bucket containing Firehose failed deliveries.
   */
  public firehoseBucket: s3.IBucket;

  /**
   * The data processor lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The firehose delivery stream.
   */
  public deliveryStream: firehose.CfnDeliveryStream;

  /**
   * The firehose log group.
   */
  public firehoseLogGroup: logs.ILogGroup;

  /**
   * The builder for the `OpenSearchStorageConnector` service.
   */
  static Builder = OpenSearchStorageConnectorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: OpenSearchStorageConnectorProps) {
    super(scope, id, description, props);

    // Validate the properties.
    this.props = this.parse(OpenSearchStorageConnectorPropsSchema, props);

    ///////////////////////////////////////////
    /////    Firehose Bucket Storage      /////
    ///////////////////////////////////////////

    this.firehoseBucket = new s3.Bucket(this, 'Bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true
    });

    ///////////////////////////////////////////
    /////   Firehose Delivery Stream      /////
    ///////////////////////////////////////////

    // The Firehose log group.
    this.firehoseLogGroup = new logs.LogGroup(this, 'FirehoseLogGroup');

    // The IAM role to be used by the delivery stream.
    const deliveryRole = this.getFirehoseRole(id);

    // OpenSearch delivery configuration.
    const openSearchProps: any = {
      bufferingHints: this.props.bufferingHints,
      domainArn: this.props.domain.domainArn,
      documentIdOptions: {
        defaultDocumentIdFormat: 'FIREHOSE_DEFAULT'
      },
      indexName: this.props.index,
      indexRotationPeriod: this.props.indexRotationPeriod,
      roleArn: deliveryRole.roleArn,
      s3Configuration: {
        bucketArn: this.firehoseBucket.bucketArn,
        roleArn: deliveryRole.roleArn,
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: this.firehoseLogGroup.logGroupName,
          logStreamName: 's3'
        }
      },
      cloudWatchLoggingOptions: {
        enabled: true,
        logGroupName: this.firehoseLogGroup.logGroupName,
        logStreamName: 'delivery'
      }
    };

    // If a VPC configuration is specified, add it to the
    // delivery stream configuration.
    if (this.props.vpc) {
      openSearchProps.vpcConfiguration = {
        roleArn: deliveryRole.roleArn,
        securityGroupIds: this.props.domain.connections.securityGroups.map(
          sg => sg.securityGroupId
        ),
        subnetIds: this.props.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        }).subnetIds
      };
    }

    // The delivery stream which will store buffered
    // document data in OpenSearch.
    this.deliveryStream = new firehose.CfnDeliveryStream(this, 'Stream', {
      deliveryStreamType: 'DirectPut',
      amazonopensearchserviceDestinationConfiguration: openSearchProps
    });

    super.bind();
  }

  /**
   * We override the `getInput` method to allow the previous middlewares
   * to write their data directly to the Firehose delivery stream.
   * @returns the Firehose delivery stream that should be used by
   * the previous middlewares to write their data.
   */
  public getInput() {
    return (this.deliveryStream);
  }

  /**
   * Creates the IAM role to be used by the Firehose
   * delivery stream.
   * @param id the identifier of the role.
   * @returns the created role.
   */
  private getFirehoseRole(id: string): iam.IRole {
    const policy = new iam.PolicyDocument({
      statements:[
        // VPC Policy
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ec2:DescribeVpcs',
            'ec2:DescribeVpcAttribute',
            'ec2:DescribeSubnets',
            'ec2:DescribeSecurityGroups',
            'ec2:DescribeNetworkInterfaces',
            'ec2:CreateNetworkInterface',
            'ec2:CreateNetworkInterfacePermission',
            'ec2:DeleteNetworkInterface'
          ],
          resources: ['*']
        }),

        // S3 Delivery Policy
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:AbortMultipartUpload',
            's3:GetBucketLocation',
            's3:GetObject',
            's3:ListBucket',
            's3:ListBucketMultipartUploads',
            's3:PutObject'
          ],
          resources: [
            this.firehoseBucket.bucketArn,
            `${this.firehoseBucket.bucketArn}/*`
          ]
        }),

        // OpenSearch Write Policy
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'es:DescribeElasticsearchDomain',
            'es:DescribeElasticsearchDomains',
            'es:DescribeElasticsearchDomainConfig',
            'es:ESHttpPost',
            'es:ESHttpPut'
          ],
          resources: [
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}`,
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/*`
          ]
        }),

        // OpenSearch Read Policy
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'es:ESHttpGet'
          ],
          resources: [
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/_all/_settings`,
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/_cluster/stats`,
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/cloudwatch-event*/_mapping/`,
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/_nodes`,
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/_nodes/stats`,
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/_nodes/*/stats`,
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/_stats`,
            `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${this.props.domain.domainName}/cloudwatch-event*/_stats`
          ]
        }),

        // CloudWatch Logs Policy
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:PutLogEvents'
          ],
          resources: [
            `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:${this.firehoseLogGroup.logGroupName}:log-stream:*`
          ]
        })
      ]
    });

    return (new iam.Role(this, `FirehoseRole-${id}`, {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      description: 'Firehose delivery stream role.',
      inlinePolicies: {
        'StreamPolicy': policy
      }
    }));
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(_: iam.IGrantable): iam.Grant {
    return ({} as iam.Grant);
  }

  /**
   * @returns an array of mime-types supported as input
   * type by this middleware.
   */
  supportedInputTypes(): string[] {
    return ([
      '*/*'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([]);
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
}

export { IndexRotationPeriod } from './definitions/opts';
