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
 * CDK Nag for scheduler event trigger
 *
 * @group nag/middleware/scheduler-event-trigger
 */

import path from 'path';
import fs from 'fs';

import * as scheduler from '@aws-cdk/aws-scheduler-alpha';
import { App, Aspects, Stack } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { SchedulerEventTrigger } from '../../src';
import { CacheStorage } from '@project-lakechain/core';

const mockApp = new App();
const mockStack = new Stack(mockApp, 'NagStack', {});

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

const time = (offset = 5): Date => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + offset);
  return (date);
};

const uris = [
  'https://aws.amazon.com/builders-library/dependency-isolation/',
  'https://aws.amazon.com/builders-library/cicd-pipeline/',
  'https://aws.amazon.com/builders-library/reliability-and-constant-work/'
];
const cache = new CacheStorage(mockStack, 'Cache', {});

new SchedulerEventTrigger.Builder()
    .withScope(mockStack)
    .withCacheStorage(cache)
    .withIdentifier('SchedulerEventTrigger')
    .withSchedule(
        scheduler.ScheduleExpression.at(time())
    )
    .withDocuments(uris)
    .build();

Aspects.of(mockStack).add(new AwsSolutionsChecks({ verbose: true }));

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/Cache/Storage/Resource',
    [
      { id: 'AwsSolutions-S1', reason: 'Ephemeral data transiting in S3 (data pipeline), no need to enable access logs' },
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/SchedulerEventTrigger/Storage/Storage/Resource',
    [
      { id: 'AwsSolutions-S1', reason: 'Ephemeral data transiting in S3 (data pipeline), no need to enable access logs' },
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/SchedulerEventTrigger/Compute/ServiceRole/DefaultPolicy/Resource',
    [
      { id: 'AwsSolutions-IAM5', reason: 'Limited to the topic (using grantPublish on Lambda) and the s3 bucket' },
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/SchedulerEventTrigger/Compute/Resource',
    [
      { id: 'AwsSolutions-L1', reason: 'Using NodeJS 18 which was the latest until very recently' },
    ],
);

NagSuppressions.addStackSuppressions(
    mockStack,
    [
      { id: 'AwsSolutions-IAM4', reason: 'Using standard managed policies (LambdaBasicExecutionRole)' },
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/SchedulerRoleForTarget-1441a7/DefaultPolicy/Resource',
    [
      { id: 'AwsSolutions-IAM5', reason: '* is used for the Lambda versions/aliases' },
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/DefaultPolicy/Resource',
    [
      { id: 'AwsSolutions-IAM5', reason: 'BucketDeployment CDK construct, cannot customize policies, limited to the S3 bucket' },
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/Resource',
    [
      { id: 'AwsSolutions-L1', reason: 'BucketDeployment CDK construct, cannot customize Lambda version' },
    ],
);

NagSuppressions.addResourceSuppressionsByPath(
  mockStack,
  '/NagStack/SchedulerEventTrigger/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS2', reason: 'SNS server-side encryption is not enabled yet'},
  ],
);

NagSuppressions.addResourceSuppressionsByPath(
  mockStack,
  '/NagStack/SchedulerEventTrigger/Topic/Resource',
  [
    {id: 'AwsSolutions-SNS3', reason: 'Not possible to enable SSL for SNS yet'},
  ],
);

describe('CDK Nag', () => {

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(mockStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    if (errors && errors.length > 0) {
      console.log(errors);
    }
    expect(errors).toHaveLength(0);
  });

});
