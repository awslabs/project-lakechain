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

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { WhisperModel } from "./whisper-model";

/**
 * @return the characteristics of the GPU instance
 * to run in the cluster given the model size.
 * @param model the model size.
 */
const getGpuInstanceByModel = (model: WhisperModel) => {
  switch (model) {
    case 'tiny':
    case 'tiny.en':
    case 'base':
    case 'base.en':
    case 'small':
    case 'small.en':
    case 'medium':
    case 'medium.en':
      return ({
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE
        ),
        gpuCount: 1,
        cpuLimit: 4096,
        memoryLimitMiB: 7168
      });
    case 'large':
    case 'large-v1':
    case 'large-v2':
    case 'large-v3':
      return ({
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE2
        ),
        gpuCount: 1,
        cpuLimit: 8192,
        memoryLimitMiB: 14336
      });
  }
};

/**
 * @return the characteristics of the CPU instance
 * to run in the cluster given the model size.
 * @param model the model size.
 */
const getCpuInstanceByModel = (model: WhisperModel) => {
  switch (model) {
    case 'tiny':
    case 'tiny.en':
    case 'base':
    case 'base.en':
    case 'small':
    case 'small.en':
    case 'medium':
    case 'medium.en':
      return ({
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.C6A,
          ec2.InstanceSize.XLARGE
        ),
        gpuCount: 0,
        cpuLimit: 4096,
        memoryLimitMiB: 7168
      });
    case 'large':
    case 'large-v1':
    case 'large-v2':
    case 'large-v3':
      return ({
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.C6A,
          ec2.InstanceSize.XLARGE2
        ),
        gpuCount: 0,
        cpuLimit: 8192,
        memoryLimitMiB: 14336
      });
  }
};

/**
 * @returns the GPU configuration for the given model.
 * @param model the model size.
 */
export const getGpuConfiguration = (model: WhisperModel) => {
  const instance = getGpuInstanceByModel(model);
  return ({
    ...instance,
    container: {
      dockerFile: 'Dockerfile.gpu',
      platform: assets.Platform.LINUX_AMD64
    },
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(
      ecs.AmiHardwareType.GPU
    )
  });
};

/**
 * @returns the CPU configuration for the given model.
 * @param model the model size.
 */
export const getCpuConfiguration = (model: WhisperModel) => {
  const instance = getCpuInstanceByModel(model);
  return ({
    ...instance,
    container: {
      dockerFile: 'Dockerfile',
      platform: assets.Platform.LINUX_AMD64
    },
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(
      ecs.AmiHardwareType.STANDARD
    )
  });
};
