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
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as custom from 'aws-cdk-lib/custom-resources';

import { Construct } from 'constructs';
import { ROLE_MAP, Service } from './roles';

/**
 * The `ServiceLinkedRole` decorator allows CDK developers to decorate their
 * CDK stacks with one, or multiple service linked role specifiers which will
 * create a new service linked role on the AWS account, and hook onto the CDK
 * resources associated with the service linked role, in order to create a dependency
 * between the service linked role and the CDK resources.
 * @param serviceName the friendly name of the service linked role.
 * @returns a class decorator that will create a service linked role on the AWS account.
 */
export function ServiceLinkedRole(serviceName: Service) {

  /**
   * Overloads the CDK stack constructor to create a service linked role
   * on the AWS account.
   */
  return function <T extends new(...args: any[]) => cdk.Stack>(constructor: T): T {

    const newConstructor: any = function (...args: any[]) {
      const instance = new constructor(...args);

      // Role attributes.
      const serviceLinkedRole = ROLE_MAP[serviceName].name;
      const serviceDomain = ROLE_MAP[serviceName].service;
      const roleDescription = ROLE_MAP[serviceName].description;
      const dependents = ROLE_MAP[serviceName].dependents;

      // The path to the lambda function directory.
      const processorPath = path.resolve(__dirname, 'lambdas', 'handler');

      // The lambda function that will create the service linked role.
      const processor = new node.NodejsFunction(instance, `Role-${serviceLinkedRole}`, {
        description: 'A custom resource allowing to create a service linked role.',
        entry: path.resolve(processorPath, 'index.js'),
        runtime: lambda.Runtime.NODEJS_18_X,
        architecture: lambda.Architecture.ARM_64,
        environment: {
          SERVICE_LINKED_ROLE_NAME: serviceLinkedRole,
          SERVICE_DOMAIN: serviceDomain,
          ROLE_DESCRIPTION: roleDescription
        },
        bundling: {
          minify: true,
          externalModules: [
            '@aws-sdk/client-iam'
          ]
        }
      });

      // Allow the lambda function to check whether the service linked role exists.
      processor.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:GetRole'],
        resources: ['*']
      }));

      // Allow the lambda function to create the service linked role.
      processor.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:CreateServiceLinkedRole'],
        resources: [
          `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/aws-service-role/${serviceDomain}/${serviceLinkedRole}*`
        ],
        conditions: {
          StringLike: {
            'iam:AWSServiceName': serviceDomain
          }
        }
      }));

      // Allow the lambda function to attach the service linked role policy.
      processor.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'iam:AttachRolePolicy',
          'iam:PutRolePolicy'
        ],
        resources: [
          `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/aws-service-role/${serviceDomain}/${serviceLinkedRole}`
        ]
      }));

      // Create a custom resource that will upload the saved object.
      const resource = new cdk.CustomResource(instance, `Resource-${serviceLinkedRole}`, {
        serviceToken: new custom.Provider(instance, `Provider-${serviceLinkedRole}`, {
          onEventHandler: processor
        }).serviceToken,
        resourceType: 'Custom::ServiceLinkedRole',
        properties: {
          ServiceLinkedRole: serviceLinkedRole
        }
      });
      
      // Add a dependency between the service linked role and the associated resources
      // by using CDK aspects.
      cdk.Aspects.of(instance).add(new class implements cdk.IAspect {
        public visit(node: Construct): void {
          for (const dependent of dependents ?? []) {
            if (node instanceof dependent) {
              console.log(`Adding dependency to ${node}`);
              node.node.addDependency(resource.node.defaultChild as cdk.CfnResource);
            }
          }
        }
      });

      return (instance);
    };

    newConstructor.prototype = Object.create(constructor.prototype);
    newConstructor.prototype.constructor = constructor;
    
    return (newConstructor);
  }
}
