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
 * CDK Nag for sqs event trigger
 *
 * @group nag/middleware/sqs-event-trigger
 */

import fs from 'node:fs';
import path from 'node:path';

import { App, Stack } from 'aws-cdk-lib';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';

import { CacheStorage } from '@project-lakechain/core';
import { SqsEventTrigger } from '../../src';
import {
  acknowledge,
  acknowledgeByPath,
  getNagErrors
} from './acknowledge';

const mockApp = new App();
const mockStack = new Stack(mockApp, 'NagStack', {});
const cache = new CacheStorage(mockStack, 'Cache', {});
const queue = new Queue(mockStack, 'InputQueue', {
  encryption: QueueEncryption.SQS_MANAGED
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

new SqsEventTrigger.Builder()
    .withScope(mockStack)
    .withCacheStorage(cache)
    .withIdentifier('SQSEventTrigger')
    .withQueue(queue)
    .build();


acknowledge(queue, [
  { id: 'AwsSolutions-SQS3', reason: 'Queue provided by the user, not part of the middleware'},
  { id: 'AwsSolutions-SQS4', reason: 'Queue provided by the user, not part of the middleware'}
]);

acknowledgeByPath(
    mockStack,
    '/NagStack/Cache/Storage/Resource',
    [
      { id: 'AwsSolutions-S1', reason: 'Ephemeral data transiting in S3 (data pipeline), no need to enable access logs' },
    ],
);

acknowledgeByPath(
    mockStack,
    '/NagStack/SQSEventTrigger/Compute/ServiceRole/DefaultPolicy/Resource',
    [
      { id: 'AwsSolutions-IAM5', reason: 'Limited to the topic (using grantPublish on Lambda) and the s3 bucket' },
    ],
);

acknowledgeByPath(
    mockStack,
    '/NagStack/SQSEventTrigger/Compute/Resource',
    [
      { id: 'AwsSolutions-L1', reason: 'Using NodeJS 18 which was the latest until very recently' },
    ],
);

acknowledge(
    mockStack,
    [
      { id: 'AwsSolutions-IAM4', reason: 'Using standard managed policies (LambdaBasicExecutionRole)' },
    ],
);

acknowledgeByPath(
  mockStack,
  '/NagStack/SQSEventTrigger/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS2', reason: 'SNS server-side encryption is not enabled yet'},
  ],
);

acknowledgeByPath(
  mockStack,
  '/NagStack/SQSEventTrigger/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS3', reason: 'Not possible to enable SSL for SNS yet'},
  ],
);

describe('CDK Nag', () => {

  test('No unsuppressed Errors', () => {
    expect(getNagErrors(mockStack)).toHaveLength(0);
  });

});
