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
import { InfrastructureDefinition } from './infrastructure';

/**
 * A helper function returning the platform (AMD64 or ARM64)
 * to use given an instance type.
 * @param instanceType the instance type to evaluate.
 * @returns the platform to use.
 */
const getPlatform = (instanceType: ec2.InstanceType) => {
  if (instanceType.architecture === ec2.InstanceArchitecture.ARM_64) {
    return assets.Platform.LINUX_ARM64;
  } else {
    return assets.Platform.LINUX_AMD64;
  }
};

/**
 * @param instanceType the instance type to evaluate.
 * @returns whether the instance type is a GPU instance.
 */
export const isGpu = (instanceType: ec2.InstanceType) => {
  const name = instanceType.toString();

  return (name.startsWith('g')
    || name.startsWith('p')
    || ['graphics', 'deep-learning'].includes(name)
  );
};

/**
 * @param infrastructure the infrastructure to use.
 * @returns the GPU configuration for the given infrastructure.
 */
export const getGpuConfiguration = (infrastructure: InfrastructureDefinition) => {
  const instanceName = infrastructure.instanceType.toString();

  if (!isGpu(infrastructure.instanceType())) {
    throw new Error(`The instance type ${instanceName} is not a GPU instance.`);
  }

  return ({
    instanceType: infrastructure.instanceType(),
    memoryLimitMiB: infrastructure.maxMemory(),
    gpuCount: infrastructure.gpus(),
    container: {
      platform: getPlatform(infrastructure.instanceType())
    },
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(
      ecs.AmiHardwareType.GPU
    )
  });
};

/**
 * @returns the CPU configuration for the given infrastructure.
 * @param infrastructure the infrastructure to use.
 */
export const getCpuConfiguration = (infrastructure: InfrastructureDefinition) => {
  return ({
    instanceType: infrastructure.instanceType(),
    memoryLimitMiB: infrastructure.maxMemory(),
    gpuCount: 0,
    container: {
      platform: getPlatform(infrastructure.instanceType())
    },
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(
      ecs.AmiHardwareType.STANDARD
    )
  });
};

/**
 * @returns the configuration to use for the given infrastructure and compute type.
 * @param infrastructure the infrastructure to use.
 * @param computeType the compute type to use.
 */
export const getConfiguration = (infrastructure: InfrastructureDefinition) => {
  const useGpuInstance = isGpu(infrastructure.instanceType());

  return (useGpuInstance
    ? getGpuConfiguration(infrastructure)
    : getCpuConfiguration(infrastructure));
};