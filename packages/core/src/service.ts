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
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { valid } from 'semver';
import { Construct } from 'constructs';

/**
 * A code associated with the deployed service used
 * to track the number of deployments.
 */
const TRACKING_CODE = 'uksb-1tupboc38';

/**
 * The regular expression used to extract the tracking code
 * from the stack description.
 */
const TRACKING_REGEXP = new RegExp(
  '(.*) \\(' + TRACKING_CODE + '\\)( \\(version:([^)]*)\\))?( \\(tag:([^)]*)\\))?'
);

/**
 * The separator used to separate tracking tags.
 * This separator is used to separate tags in the stack description.
 */
const TRACKING_TAG_SEPARATOR = ',';

/**
 * Properties associated with a micro-service.
 */
export class ServiceDescription {

  /**
   * The service name.
   */
  readonly name: string;

  /**
   * The description of the service.
   */
  readonly description: string;

  /**
   * The service version.
   */
  readonly version: string;

  /**
   * Custom attributes.
   */
  attrs: {
    [key: string]: string;
  }
}

/**
 * A Service represents a Cloud micro-service that is part
 * of a deployment.
 */
export class Service extends Construct {

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, protected description: ServiceDescription) {
    super(scope, id);

    // Verifying whether the version is valid.
    if (!valid(description.version)) {
      throw new Error(`Semver value '${description.version}' is invalid`);
    }

    // Exporting the service attributes.
    for (const [key, value] of Object.entries(description.attrs ?? {})) {
      this.addProperty(key, value);
    }

    // Exporting the description.
    this.addProperty('description', description.description);

    if (!process.env.DISABLE_TRACKING_CODE) {
      // Apply the tracking code to the current stack.
      this.applyTrackingCode(description, TRACKING_CODE);
    }

    // Adding service tags.
    cdk.Tags.of(this).add('Context', 'project-lakechain');
    cdk.Tags.of(this).add('Service', description.name);
    cdk.Tags.of(this).add('Version', description.version);
  }

  /**
   * @returns the service description.
   */
  public serviceDescription(): ServiceDescription {
    return (this.description);
  }

  /**
   * Registers a new SSM parameter associated with the
   * given key and value.
   * @returns the newly created SSM parameter.
   */
  public addProperty(key: string, value: string) {
    return (new ssm.StringParameter(this, key, {
      description: `Attribute '${key}' for service '${this.description.name}'.`,
      parameterName: `/services/${this.node.addr}/${this.description.name}/${this.description.version}/${key}`,
      stringValue: value
    }));
  }

  /**
   * Adds the given tracking code to the stack description.
   * @param serviceDescription the service description.
   * @param code the tracking code to apply.
   */
  private applyTrackingCode(serviceDescription: ServiceDescription, code: string) {
    const stack = cdk.Stack.of(this);
    const description = stack.templateOptions.description ?? '';
    const fullDescription = TRACKING_REGEXP.exec(description);
    const tag = serviceDescription.name.split(TRACKING_TAG_SEPARATOR).join('_');

    if (fullDescription == null) {
      stack.templateOptions.description = `${description} (${code}) (version:${serviceDescription.version}) (tag:${tag})`;
    } else {
      const description = fullDescription[1];
      const existingTags = fullDescription[5];
      let newTags;
      
      if (existingTags) {
        const tags = existingTags.split(TRACKING_TAG_SEPARATOR);
        if (tags.includes(tag)) {
          newTags = existingTags;
        } else {
          newTags = existingTags + TRACKING_TAG_SEPARATOR + tag;
        }
      } else {
        newTags = tag;
      }

      stack.templateOptions.description = `${description} (${code}) (version:${serviceDescription.version}) (tag:${newTags})`;
    }
  }
}
