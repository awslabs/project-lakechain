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
 * Interface for the LanceDB layer.
 */
export class LanceDbLayer {

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @returns a lambda layer version for the LanceDB library
   * compiled for ARM64.
   */
  static arm64(scope: Construct, id: string): lambda.LayerVersion {
    const architecture = lambda.Architecture.ARM_64;

    // The Docker image to use to build the layer.
    const image = cdk.DockerImage.fromRegistry(
      'public.ecr.aws/sam/build-nodejs18.x:1.124.0-arm64'
    );

    // Builds the LanceDB library for the target architecture
    // and outputs the result in the /asset-output directory.
    const layerAsset = new s3assets.Asset(scope, `Asset-${id}`, {
      path: path.join(__dirname),
      bundling: {
        image,
        platform: architecture.dockerPlatform,
        command: [
          '/bin/bash',
          '-c',
          'npm install --prefix=/asset-output/nodejs --arch=arm64 --platform=linux vectordb @lancedb/vectordb-linux-arm64-gnu'
        ],
        outputType: cdk.BundlingOutput.AUTO_DISCOVER,
        network: 'host',
        user: 'root'
      }
    });

    return (new lambda.LayerVersion(scope, id, {
      description: 'Provides a lambda layer for LanceDB.',
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

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @returns a lambda layer version for the LanceDB library
   * compiled for X64.
   */
  static x64(scope: Construct, id: string): lambda.LayerVersion {
    const architecture = lambda.Architecture.X86_64;

    // The Docker image to use to build the layer.
    const image = cdk.DockerImage.fromRegistry(
      'public.ecr.aws/sam/build-nodejs18.x:1.124.0-x86_64'
    );

    // Builds the LanceDB library for the target architecture
    // and outputs the result in the /asset-output directory.
    const layerAsset = new s3assets.Asset(scope, `Asset-${id}`, {
      path: path.join(__dirname),
      bundling: {
        image,
        platform: architecture.dockerPlatform,
        command: [
          '/bin/bash',
          '-c',
          'npm install --prefix=/asset-output/nodejs --arch=x64 --platform=linux vectordb @lancedb/vectordb-linux-x64-gnu'
        ],
        outputType: cdk.BundlingOutput.AUTO_DISCOVER,
        network: 'host',
        user: 'root'
      }
    });

    return (new lambda.LayerVersion(scope, id, {
      description: 'Provides a lambda layer for LanceDB.',
      code: lambda.Code.fromBucket(
        layerAsset.bucket,
        layerAsset.s3ObjectKey
      ),
      compatibleRuntimes: [
        lambda.Runtime.NODEJS_18_X
      ],
      compatibleArchitectures: [
        lambda.Architecture.X86_64
      ]
    }));
  }
}