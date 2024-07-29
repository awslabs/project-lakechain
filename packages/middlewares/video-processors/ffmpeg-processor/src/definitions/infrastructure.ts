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
import { z } from 'zod';

/**
 * The infrastructure definition schema.
 */
export const InfrastructureDefinitionPropsSchema = z.object({
  instanceType: z.custom<ec2.InstanceType>(),
  maxMemory: z.number(),
  gpus: z.number()
});

// The type of the `InfrastructureDefinitionProps` schema.
export type InfrastructureDefinitionProps = z.infer<typeof InfrastructureDefinitionPropsSchema>;

/**
 * The infrastructure definition builder.
 */
export class InfrastructureDefinitionBuilder {
  private props: Partial<InfrastructureDefinitionProps> = {};

  /**
   * Sets the instance type to use.
   * @param instanceType the instance type to use.
   * @returns the builder instance.
   */
  public withInstanceType(instanceType: ec2.InstanceType) {
    this.props.instanceType = instanceType;
    return (this);
  }

  /**
   * Sets the maximum memory to use.
   * @param maxMemory the maximum memory to use.
   * @returns the builder instance.
   */
  public withMaxMemory(maxMemory: number) {
    this.props.maxMemory = maxMemory;
    return (this);
  }

  /**
   * Sets the number of GPUs to use.
   * @param gpus the number of GPUs to use.
   * @returns the builder instance.
   */
  public withGpus(gpus: number) {
    this.props.gpus = gpus;
    return (this);
  }

  public build(): InfrastructureDefinition {
    return (InfrastructureDefinition.from(this.props));
  }
}

/**
 * Describes the infrastructure to use for running
 * FFMPEG.
 */
export class InfrastructureDefinition {

  /**
   * The `InfrastructureDefinition` builder.
   */
  public static readonly Builder = InfrastructureDefinitionBuilder;

  /**
   * Creates a new instance of the `InfrastructureDefinition` class.
   * @param props the infrastructure definition properties.
   */
  constructor(public props: InfrastructureDefinitionProps) {}

  /**
   * @returns the instance type to use.
   */
  public instanceType() {
    return (this.props.instanceType);
  }

  /**
   * @returns the maximum memory to use.
   */
  public maxMemory() {
    return (this.props.maxMemory);
  }

  /**
   * @returns the number of GPUs to use.
   */
  public gpus() {
    return (this.props.gpus);
  }

  /**
   * Creates a new instance of the `InfrastructureDefinition` class.
   * @param props the infrastructure definition properties.
   * @returns a new instance of the `InfrastructureDefinition` class.
   */
  public static from(props: any) {
    return (new InfrastructureDefinition(InfrastructureDefinitionPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the
   * infrastructure definition.
   */
  public toJSON() {
    return (this.props);
  }
}
