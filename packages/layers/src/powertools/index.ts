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

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Interface for the PowerTools Python layer.
 */
class PowerToolsPythonLayer {

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param version the layer version to use.
   * @returns a lambda layer version for the AWS PowerTools Python library
   * compiled for x64.
   */
  static x64(scope: Construct, id: string, version = 60): lambda.ILayerVersion {
    return (lambda.LayerVersion.fromLayerVersionArn(scope, id,
      `arn:aws:lambda:${cdk.Aws.REGION}:017000801446:layer:AWSLambdaPowertoolsPythonV2:${version}`
    ));
  }

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param version the layer version to use.
   * @returns a lambda layer version for the AWS PowerTools Python library
   * compiled for ARM64.
   */
  static arm64(scope: Construct, id: string, version = 60): lambda.ILayerVersion {
    return (lambda.LayerVersion.fromLayerVersionArn(scope, id,
      `arn:aws:lambda:${cdk.Aws.REGION}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:${version}`
    ));
  }
}

/**
 * Interface for the PowerTools Typescript layer.
 */
class PowerToolsTypescriptLayer {

  /**
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @returns a lambda layer version for the AWS PowerTools Typescript library.
   */
  static layer(scope: Construct, id: string, version = 27): lambda.ILayerVersion {
    return (lambda.LayerVersion.fromLayerVersionArn(scope, id,
      `arn:aws:lambda:${cdk.Aws.REGION}:094274105915:layer:AWSLambdaPowertoolsTypeScript:${version}`
    ));
  }
}

/**
 * Interface for the PowerTools Typescript and
 * Python layers.
 */
export class PowerToolsLayer {

  /**
   * @returns a lambda layer version for the AWS Python PowerTools
   * library, compatible with both x64 and ARM64 architectures.
   */
  static python() {
    return (PowerToolsPythonLayer);
  }

  /**
   * @returns a lambda layer version for the AWS Typescript PowerTools
   * library.
   */
  static typescript() {
    return (PowerToolsTypescriptLayer);
  }
}