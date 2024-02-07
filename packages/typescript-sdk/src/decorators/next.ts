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

import { CloudEventMethodDecorator } from './types.js';
import { CloudEvent } from '../models/cloud-event/cloud-event.js';
import { logger, tracer } from '../powertools/index.js';
import {
  SNSClient,
  PublishCommand
} from '@aws-sdk/client-sns';

/**
 * Represents the ARN of the SNS topic to publish
 * cloud events to so they can be processed by other
 * middlewares.
 */
const SNS_TARGET_TOPIC = process.env.SNS_TARGET_TOPIC as string;

/**
 * The name of the service.
 */
const SERVICE_NAME = (
  process.env.POWERTOOLS_SERVICE_NAME ?? process.env.SERVICE_NAME
) as string;

/**
 * The SNS client instance.
 */
const sns = tracer.captureAWSv3Client(
  new SNSClient({
    region: process.env.AWS_REGION,
    maxAttempts: 5
  })
);

/**
 * Represents the next target to publish the event to.
 */
export interface NextTarget {

  /**
   * The ARN of a valid SNS topic.
   */
  snsTopicArn: string;
}

export interface NextProps {

  /**
   * The next target to publish the event to.
   */
  target: NextTarget;

  /**
   * Whether to log the event.
   */
  logEvent?: boolean;
}

/**
 * Publishes the given cloud event to an SNS topic
 * for further processing by the next middlewares.
 * @param event the cloud event object to publish.
 * @param target an optional object describing the
 * next target to publish the event to.
 * @returns a promise which resolves when the event has been published.
 */
export const send = (event: CloudEvent, target?: NextTarget) => {
  // Update the call stack with the current service.
  event.data().props.callStack.unshift(SERVICE_NAME);

  // Publish the event to the SNS topic.
  return (sns.send(
    new PublishCommand({
      TopicArn: target?.snsTopicArn,
      Message: JSON.stringify(event)
    })
  ));
};

/**
 * Passes the cloud event produced by the decorated function
 * to the next middlewares.
 * @returns the decoration function.
 */
export const next = (
  props: NextProps = {
    target: { snsTopicArn: SNS_TARGET_TOPIC },
    logEvent: true
  }
): CloudEventMethodDecorator => {
  return (_target, _propertyKey, descriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: CallableFunction, ...args): Promise<CloudEvent> {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const handlerRef = this;

      // Call the original function and get the cloud event from it.
      const event = await originalMethod.apply(handlerRef, args);

      if (event) {
        // Log the event with the Powertools logger.
        if (props.logEvent) {
          logger.info(event as any);
        }

        // Forward the event to the next middlewares.
        await send(event, props.target);
      }

      return (event);
    };

    return (descriptor);
  };
};
