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

/**
 * CDK Nag for whisper transcriber
 *
 * @group nag/middleware/whisper-transcriber
 */

import path from 'path';
import fs from 'fs';

import { App, Aspects, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { WhisperTranscriber } from '../../src';
import { CacheStorage } from '@project-lakechain/core';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { suppressNagS3EventTrigger } from './suppress';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

const mockApp = new App();
const mockStack = new Stack(mockApp, 'NagStack', {});
const cache = new CacheStorage(mockStack, 'Cache', {});
const bucket = new Bucket(mockStack, 'InputBucket', {
  removalPolicy: RemovalPolicy.DESTROY,
  enforceSSL: true
});
const oldResolve = path.resolve;

/**
 * Mock the `path.resolve` function to point to the `dist`
 * directory instead of the `src` directory when running
 * in the context of the test suite.
 * @param args the path segments.
 * @returns a resolved path.
 */
path.resolve = (...args: string[]) => {
  const endsWithJs = args[args.length - 1].endsWith('.js');
  const pathExists = fs.existsSync(oldResolve(...args));

  if (endsWithJs && !pathExists) {
    // Replace the `src` directory by `dist` in the entire path
    const newPath = oldResolve(...args).replace(/src/g, 'dist');
    return (oldResolve(newPath));
  }
  return (oldResolve(...args));
};

const source = new S3EventTrigger.Builder()
    .withScope(mockStack)
    .withCacheStorage(cache)
    .withIdentifier('S3EventTrigger')
    .withBucket(bucket)
    .build();

const vpc = new Vpc(mockStack, 'vpc', {
  subnetConfiguration: [{
    cidrMask: 24,
    name: 'ingress',
    subnetType: SubnetType.PUBLIC,
  },
  {
    cidrMask: 24,
    name: 'application',
    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
  },
  {
    cidrMask: 28,
    name: 'rds',
    subnetType: SubnetType.PRIVATE_ISOLATED,
  }]
});
new WhisperTranscriber.Builder()
    .withScope(mockStack)
    .withCacheStorage(cache)
    .withIdentifier('WhisperTranscriber')
    .withVpc(vpc)
    .withModel('base')
    .withOutputFormat('vtt')
    .withCloudWatchInsights(true)
    .withSource(source)
    .build();


const cloudAssembly = mockApp.synth({force:true});
const stack = cloudAssembly.getStackByName('NagStack');
console.log(JSON.stringify(stack.template, null, 2));

Aspects.of(mockStack).add(new AwsSolutionsChecks({ verbose: true }));

suppressNagS3EventTrigger(mockStack, bucket);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/vpc/Resource',
    [{ id: 'AwsSolutions-VPC7', reason: 'VPC is provided by the customer, not part of the middleware' }],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/WhisperTranscriber/Cluster/TaskDefinition/Resource',
    [
      { id: 'AwsSolutions-ECS2', reason: 'No secret is injected, only technical references (ARN, REGION, ...)' },
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/WhisperTranscriber/Storage/Storage/Resource',
    [
      {id: 'AwsSolutions-S1', reason: 'Ephemeral data transiting in S3 (data pipeline), no need to enable access logs'},
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/WhisperTranscriber/Cluster/Asg/ASG',
    [
      { id: 'AwsSolutions-EC26', reason: 'ASG generated by ECS AsgCapacityProvider Construct. Cannot customize this' },
      { id: 'AwsSolutions-AS3', reason: 'ASG generated by ECS AsgCapacityProvider Construct. Cannot customize this' }
    ],
);

NagSuppressions.addStackSuppressions(
    mockStack,
    [
      {id: 'AwsSolutions-L1', reason: 'Using NodeJS 18 which was the latest until very recently'},
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/WhisperTranscriber/Cluster/InstanceRole/DefaultPolicy/Resource',
    [
      {id: 'AwsSolutions-IAM5', reason: 'Permissions limited to the ECS Cluster only'},
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/WhisperTranscriber/Cluster/ExecutionRole/DefaultPolicy/Resource',
    [
      {id: 'AwsSolutions-IAM5', reason: 'Execution Role generated by CDK Construct, limited to ECR'},
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/WhisperTranscriber/Cluster/TaskDefinition/TaskRole/DefaultPolicy/Resource',
    [
      {id: 'AwsSolutions-IAM5', reason: 'Permissions limited to specific buckets'},
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/WhisperTranscriber/Cluster/AutoScaler/ServiceRole/DefaultPolicy/Resource',
    [
      {id: 'AwsSolutions-IAM5', reason: 'X-Ray tracing requires *'},
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
  mockStack,
  '/NagStack/S3EventTrigger/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS2', reason: 'SNS server-side encryption is not enabled yet'},
  ],
);

NagSuppressions.addResourceSuppressionsByPath(
  mockStack,
  '/NagStack/S3EventTrigger/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS3', reason: 'Not possible to enable SSL for SNS yet'},
  ],
);

NagSuppressions.addResourceSuppressionsByPath(
  mockStack,
  '/NagStack/WhisperTranscriber/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS2', reason: 'SNS server-side encryption is not enabled yet'},
  ],
);

NagSuppressions.addResourceSuppressionsByPath(
  mockStack,
  '/NagStack/WhisperTranscriber/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS3', reason: 'Not possible to enable SSL for SNS yet'},
  ],
);

describe('CDK Nag', () => {

  test('No unsuppressed Errors', () => {
    const errors = Annotations
      .fromStack(mockStack)
      .findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    if (errors && errors.length > 0) {
      console.log(errors);
    }
    expect(errors).toHaveLength(0);
  });

});
