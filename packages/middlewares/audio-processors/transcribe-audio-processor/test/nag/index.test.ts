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
 * CDK Nag for transcribe audio processor
 *
 * @group nag/middleware/transcribe-audio-processor
 */

import fs from 'node:fs';
import path from 'node:path';

import { App, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';

import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { TranscribeAudioProcessor } from '../../src';
import { suppressNagS3EventTrigger } from './suppress';
import {
  acknowledge,
  acknowledgeByPath,
  getNagErrors
} from './acknowledge';

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

new TranscribeAudioProcessor.Builder()
    .withScope(mockStack)
    .withCacheStorage(cache)
    .withIdentifier('TranscribeAudioProcessor')
    .withSource(source)
    .build();


suppressNagS3EventTrigger(mockStack, bucket);

acknowledge(
    mockStack,
    [
      {id: 'AwsSolutions-L1', reason: 'Using NodeJS 18 which was the latest until very recently'},
    ],
);

acknowledgeByPath(
    mockStack,
    '/NagStack/TranscribeAudioProcessor/Storage/Storage/Resource',
    [
      {id: 'AwsSolutions-S1', reason: 'Ephemeral data transiting in S3 (data pipeline), no need to enable access logs'},
    ],
);

acknowledgeByPath(
    mockStack,
    '/NagStack/TranscribeAudioProcessor/TranscribeRole/DefaultPolicy/Resource',
    [
      {id: 'AwsSolutions-IAM5', reason: 'Permissions limited to one specific bucket'},
    ],
);

acknowledgeByPath(
    mockStack,
    '/NagStack/TranscribeAudioProcessor/InputHandler/ServiceRole/DefaultPolicy/Resource',
    [
      {id: 'AwsSolutions-IAM5', reason: 'X-Ray tracing requires *'},
    ],
);

acknowledgeByPath(
    mockStack,
    '/NagStack/TranscribeAudioProcessor/ResultHandler/ServiceRole/DefaultPolicy/Resource',
    [
      {id: 'AwsSolutions-IAM5', reason: 'X-Ray tracing requires *'},
    ],
);

acknowledgeByPath(
  mockStack,
  '/NagStack/S3EventTrigger/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS2', reason: 'SNS server-side encryption is not enabled yet'},
  ],
);

acknowledgeByPath(
  mockStack,
  '/NagStack/S3EventTrigger/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS3', reason: 'Not possible to enable SSL for SNS yet'},
  ],
);

acknowledgeByPath(
  mockStack,
  '/NagStack/TranscribeAudioProcessor/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS2', reason: 'SNS server-side encryption is not enabled yet'},
  ],
);

acknowledgeByPath(
  mockStack,
  '/NagStack/TranscribeAudioProcessor/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS3', reason: 'Not possible to enable SSL for SNS yet'},
  ],
);

describe('CDK Nag', () => {

  test('No unsuppressed Errors', () => {
    expect(getNagErrors(mockStack)).toHaveLength(0);
  });

});
