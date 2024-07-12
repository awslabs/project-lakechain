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

import {
  IAMClient,
  CreateServiceLinkedRoleCommand,
  GetRoleCommand
} from '@aws-sdk/client-iam';

/**
 * The service linked IAM role name.
 */
const SERVICE_LINKED_ROLE_NAME = process.env.SERVICE_LINKED_ROLE_NAME as string;

/**
 * The domain associated with the AWS service.
 */
const SERVICE_DOMAIN = process.env.SERVICE_DOMAIN as string;

/**
 * The description of the service linked role.
 */
const ROLE_DESCRIPTION = process.env.ROLE_DESCRIPTION as string;

/**
 * The IAM client.
 */
const iam = new IAMClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3
});

/**
 * Creates the service linked role associated with the given service.
 * @param event the CloudFormation custom resource event
 * @returns the response to the custom resource event
 * @throws if an error occurs
 */
const onCreate = async (event: any) => {
  const { ServiceLinkedRole } = event.ResourceProperties;
  
  try {
    // Checking if the service linked role exists.
    await iam.send(new GetRoleCommand({
      RoleName: SERVICE_LINKED_ROLE_NAME
    }));
  } catch (err: any) {
    if (err.name === 'NoSuchEntityException') {
      await iam.send(new CreateServiceLinkedRoleCommand({
        AWSServiceName: SERVICE_DOMAIN,
        Description: ROLE_DESCRIPTION
      }));
    } else {
      throw err;
    }
  }

  return {
    PhysicalResourceId: ServiceLinkedRole
  };
};

/**
 * The custom resource entry point.
 * @param event the CloudFormation custom resource event
 * @returns the response to the custom resource event
 */
export const handler = (event: any) => {
  const { ServiceLinkedRole } = event.ResourceProperties;

  if (event.RequestType === 'Create') {
    return (onCreate(event));
  }

  return {
    PhysicalResourceId: ServiceLinkedRole
  };
};
