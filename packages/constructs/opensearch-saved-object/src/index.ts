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
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as custom from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';

import { Construct } from 'constructs';

/**
 * The properties for the `OpenSearchSavedObject` construct.
 */
export interface OpenSearchSavedObjectProps {

  /**
   * The saved object.
   */
  readonly savedObject: {
    data: any;
    name: string;
  };

  /**
   * The OpenSearch domain on which the index
   * should be created.
   */
  readonly domain: opensearch.Domain;

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
 * A custom resource making it easy to restore a saved object
 * in the OpenSearch dashboard, such as a dashboard or a visualization.
 * This construct uses a lambda function to interact with
 * the OpenSearch domain, and uses the OpenSearch SDK to
 * upload the saved object.
 * It is compatible with OpenSearch domain that are deployed
 * in a VPC and those that are not deployed in a VPC.
 */
export class OpenSearchSavedObject extends Construct {

  /**
   * OpenSearch Index constructor
   * @param scope the scope of the construct
   * @param id the id of the construct
   */
  constructor(scope: Construct, id: string, props: OpenSearchSavedObjectProps) {
    super(scope, id);

    // The domain endpoint.
    const domain = `https://${props.domain.domainEndpoint}`;

    // The path to the lambda function directory.
    const processorPath = path.resolve(__dirname, 'lambdas', 'object-manager');

    // The lambda function that will create the index.
    const processor = new node.NodejsFunction(this, 'Compute', {
      description: 'A custom resource allowing to restore saved objects on an OpenSearch domain.',
      entry: path.resolve(processorPath, 'index.js'),
      vpc: props.vpc,
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64,
      logGroup: props.logGroup,
      environment: {
        OPENSEARCH_DOMAIN: domain
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/credential-provider-node'
        ]
      }
    });

    // Allow the lambda function to manage the index.
    props.domain.grantWrite(processor);

    // Create a custom resource that will upload the saved object.
    const resource = new cdk.CustomResource(this, 'Resource', {
      serviceToken: new custom.Provider(this, 'Provider', {
        onEventHandler: processor,
        logGroup: props.logGroup
      }).serviceToken,
      resourceType: 'Custom::OpenSearchSavedObject',
      properties: {
        SavedObject: props.savedObject
      }
    });

    resource.node.addDependency(props.domain);
  }
}