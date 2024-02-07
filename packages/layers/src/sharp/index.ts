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
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';

/**
 * Interface for the Sharp layer.
 */
export class SharpLayer {

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @returns a lambda layer version for the Sharp library
   * compiled for ARM64.
   */
  static arm64(scope: Construct, id: string): lambda.LayerVersion {
    const runtime = lambda.Runtime.NODEJS_18_X;
    const architecture = lambda.Architecture.ARM_64;

    // Builds the Sharp library for the target architecture
    // and outputs the result in the /asset-output directory.
    const layerAsset = new s3assets.Asset(scope, `Asset-${id}`, {
      path: path.join(__dirname),
      bundling: {
        image: runtime.bundlingImage,
        platform: architecture.dockerPlatform,
        command: [
          '/bin/bash',
          '-c',
          'npm install --prefix=/asset-output/nodejs --arch=arm64 --platform=linux sharp'
        ],
        outputType: cdk.BundlingOutput.AUTO_DISCOVER,
        network: 'host',
        user: 'root'
      }
    });

    return (new lambda.LayerVersion(scope, id, {
      description: 'Provides a lambda layer for the Sharp library.',
      code: lambda.Code.fromBucket(
        layerAsset.bucket,
        layerAsset.s3ObjectKey
      ),
      compatibleRuntimes: [
        lambda.Runtime.NODEJS_18_X
      ],
      compatibleArchitectures: [
        lambda.Architecture.ARM_64
      ]
    }));
  }
}