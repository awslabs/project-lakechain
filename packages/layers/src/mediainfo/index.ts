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
 * The version of the MediaInfo library to use.
 */
const DEFAULT_MEDIA_INFO_VERSION = '23.10';

/**
 * Provides a lambda layer for the MediaInfo library.
 */
export class MediaInfoLayer {

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param architecture the architecture to build the layer for.
   * @returns a lambda layer version for the MediaInfo library
   * compiled for the given architecture.
   */
  static fromArch(
    scope: Construct,
    id: string,
    architecture: lambda.Architecture,
    version: string = DEFAULT_MEDIA_INFO_VERSION
  ): lambda.LayerVersion {
    const runtime  = lambda.Runtime.PYTHON_3_11;
    const archName = architecture === lambda.Architecture.ARM_64 ? 'arm64' : 'x64';

    // Build the layer.
    const layerAsset = new s3assets.Asset(scope, `Asset-${id}`, {
      path: path.join(__dirname),
      assetHashType: cdk.AssetHashType.OUTPUT,
      bundling: {
        image: runtime.bundlingImage,
        platform: architecture.dockerPlatform,
        command: [
          '/bin/bash',
          '-c', [
            'yum install -y wget unzip',
            `wget https://mediaarea.net/download/binary/libmediainfo0/${version}/MediaInfo_DLL_${version}_Lambda_${archName}.zip`,
            `unzip -o MediaInfo_DLL_${version}_Lambda_${archName}.zip`,
            'mkdir -p /asset-output/python',
            'cp -L lib/* /asset-output/python'
          ].join(' && ')
        ],
        outputType: cdk.BundlingOutput.AUTO_DISCOVER,
        network: 'host',
        user: 'root'
      }
    });

    // Create the layer from the build output.
    return (new lambda.LayerVersion(scope, id, {
      description: 'Provides a lambda layer for the MediaInfo library.',
      code: lambda.Code.fromBucket(
        layerAsset.bucket,
        layerAsset.s3ObjectKey
      ),
      compatibleRuntimes: [
        lambda.Runtime.PYTHON_3_11,
        lambda.Runtime.PYTHON_3_10,
        lambda.Runtime.PYTHON_3_9,
        lambda.Runtime.PYTHON_3_8
      ],
      compatibleArchitectures: [architecture]
    }));
  }

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @returns a lambda layer version for the MediaInfo library
   * compiled for x64.
   */
  static x64(scope: Construct, id: string, version: string = DEFAULT_MEDIA_INFO_VERSION): lambda.LayerVersion {
    return (MediaInfoLayer.fromArch(scope, id, lambda.Architecture.X86_64, version));
  }

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @returns a lambda layer version for the MediaInfo library
   * compiled for ARM64.
   */
  static arm64(scope: Construct, id: string, version: string = DEFAULT_MEDIA_INFO_VERSION): lambda.LayerVersion {
    return (MediaInfoLayer.fromArch(scope, id, lambda.Architecture.ARM_64, version));
  }
}