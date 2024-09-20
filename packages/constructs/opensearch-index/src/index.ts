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
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as custom from 'aws-cdk-lib/custom-resources';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as oss from '@project-lakechain/opensearch-collection';
import * as logs from 'aws-cdk-lib/aws-logs';

import { Construct } from 'constructs';
import { ServiceIdentifier } from './definitions/service-identifier';

/**
 * The properties for the OpenSearchIndex construct.
 */
export interface OpenSearchIndexProps {

  /**
   * The name of the index.
   */
  readonly indexName: string;

  /**
   * The body of the index creation request.
   */
  readonly body: Record<string, any>;

  /**
   * The OpenSearch endpoint on which the index
   * should be created.
   */
  readonly endpoint: opensearch.IDomain | oss.ICollection;

  /**
   * The VPC in which the OpenSearch domain is deployed.
   */
  readonly vpc?: ec2.IVpc;

  /**
   * The log group in which the lambda function will
   * write its logs.
   */
  readonly logGroup?: logs.ILogGroup;
}

/**
 * A custom resource making it easy to create an index
 * and manage its lifecycle as a CDK construct.
 * This construct uses a lambda function to interact with
 * the OpenSearch endpoint, and uses the OpenSearch SDK to
 * create and delete the index.
 * This construct is compatible with OpenSearch domains and serverless
 * collections deployed in a VPC or not.
 */
export class OpenSearchIndex extends Construct {

  /**
   * The name of the index managed by the construct.
   */
  public readonly indexName: string;

  /**
   * OpenSearch Index constructor
   * @param scope the scope of the construct
   * @param id the id of the construct
   */
  constructor(scope: Construct, id: string, props: OpenSearchIndexProps) {
    super(scope, id);

    // Set the index name.
    this.indexName = props.indexName;

    // The OpenSearch endpoint.
    const endpoint = this.getEndpoint(props.endpoint);

    // The identifier of the OpenSearch service.
    const serviceIdentifier = this.getServiceIdentifier(props.endpoint);

    // The path to the lambda function directory.
    const processorPath = path.resolve(__dirname, 'lambdas', 'index-manager');

    // Create the lambda function that will create the index.
    const processor = new node.NodejsFunction(this, 'Compute', {
      description: 'A custom resource managing the state of an OpenSearch index.',
      entry: path.resolve(processorPath, 'index.js'),
      vpc: props.vpc,
      timeout: cdk.Duration.seconds(10),
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      logGroup: props.logGroup,
      environment: {
        OPENSEARCH_ENDPOINT: endpoint,
        OPENSEARCH_INDEX_NAME: props.indexName,
        BODY_PARAMETERS: JSON.stringify(props.body),
        SERVICE_IDENTIFIER: serviceIdentifier
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/credential-provider-node'
        ]
      }
    });

    if (serviceIdentifier === 'es') {
      // Allow the lambda function to manage the index.
      (props.endpoint as opensearch.Domain).grantWrite(processor);
    } else if (serviceIdentifier === 'aoss') {
      const endpoint = props.endpoint as oss.Collection;

      // If the endpoint is a collection, we also need to create an
      // access policy on the collection to allow the lambda function
      // to manage the index.
      // Add a new access policy.
      endpoint.addAccessPolicy(
        this.indexName,
        [processor.role!.roleArn],
        ['aoss:CreateIndex', 'aoss:DeleteIndex', 'aoss:UpdateIndex']
      );

      // We also need to grant the lambda function permissions
      // to write to the OpenSearch index.
      processor.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [endpoint.collectionArn]
      }));
    }

    // Create a custom resource that will manage the index.
    const resource = new cdk.CustomResource(this, 'Resource', {
      serviceToken: new custom.Provider(this, 'Provider', {
        onEventHandler: processor,
        logGroup: props.logGroup
      }).serviceToken,
      resourceType: 'Custom::OpenSearchIndex',
      properties: {
        IndexName: props.indexName,
        Body: props.body,
        Endpoint: endpoint
      }
    });

    resource.node.addDependency(props.endpoint);
  }

  /**
   * Get the URL of the OpenSearch endpoint.
   * @param endpoint the OpenSearch endpoint.
   * @returns the endpoint URL.
   */
  private getEndpoint(endpoint: opensearch.IDomain | oss.ICollection): string {
    const serviceIdentifier = this.getServiceIdentifier(endpoint);

    if (serviceIdentifier === 'es') {
      return (`https://${(endpoint as opensearch.Domain).domainEndpoint}`);
    } else if (serviceIdentifier === 'aoss') {
      return ((endpoint as oss.Collection).collectionEndpoint);
    } else {
      throw new Error('Invalid endpoint.');
    }
  }

  /**
   * Get the service identifier of the OpenSearch endpoint.
   * @param endpoint the OpenSearch endpoint.
   * @returns the service identifier.
   */
  private getServiceIdentifier(endpoint: opensearch.IDomain | oss.ICollection): ServiceIdentifier {
    const e = endpoint as any;
    
    if (e.domainArn
      && e.domainName
      && e.domainId
      && e.domainEndpoint) {
      return ('es');
    } else if (e.collectionName
      && e.collectionArn
      && e.collectionId
      && e.collectionEndpoint) {
      return ('aoss');
    } else {
      throw new Error('Invalid endpoint.');
    }
  }
}