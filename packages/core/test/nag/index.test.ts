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
 * CDK Nag for Cache Storage
 *
 * @group nag/cache-storage
 */

import { App, Aspects, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CacheStorage } from '../../src';
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Annotations, Match } from "aws-cdk-lib/assertions";

const mockApp = new App();
const mockStack = new Stack(mockApp, 'NagStack');

new CacheStorage(mockStack, 'CacheStorage', {
  removalPolicy: RemovalPolicy.DESTROY
});

NagSuppressions.addResourceSuppressionsByPath(
    mockStack,
    '/NagStack/CacheStorage/Storage/Resource',
    [
      { id: 'AwsSolutions-S1', reason: 'Ephemeral data transiting in S3 (data pipeline), no need to enable access logs' },
    ],
);

Aspects.of(mockStack).add(new AwsSolutionsChecks({ verbose: true }));

describe('CDK Nag', () => {

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(mockStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    if (errors && errors.length > 0) {
      console.log(errors);
    }
    expect(errors).toHaveLength(0);
  });

});
