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

import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { invoke } from './invoke';

import {
  DefaultOntologyClassifier,
  CustomOntologyClassifier
} from '../../definitions/classifiers';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const ONTOLOGY_CLASSIFIER_PROPS = JSON.parse(process.env.ONTOLOGY_CLASSIFIER_PROPS ?? '{}');

/**
 * The ontology classifier.
 */
const classifier = ONTOLOGY_CLASSIFIER_PROPS.classifierType === 'DEFAULT' ?
  DefaultOntologyClassifier.from(ONTOLOGY_CLASSIFIER_PROPS) :
  CustomOntologyClassifier.from(ONTOLOGY_CLASSIFIER_PROPS);

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * Resolves the input documents to process.
   * This function supports both single and composite events.
   * @param event the received event.
   * @returns a promise to an array of CloudEvents to process.
   */
  private async resolveEvents(event: CloudEvent): Promise<CloudEvent[]> {
    const document = event.data().document();

    if (document.mimeType() === 'application/cloudevents+json') {
      const data = JSON.parse((await document
        .data()
        .asBuffer())
        .toString('utf-8')
      );
      return (data.map((event: string) => CloudEvent.from(event)));
    } else {
      return ([event]);
    }
  }

  /**
   * Transforms the document using the selected Amazon Bedrock
   * model, and the given parameters.
   * @param event the CloudEvent to process.
   */
  @next()
  private async processEvent(event: CloudEvent) {
    const events   = await this.resolveEvents(event);
    const prompts  = classifier.getPrompts();
    const promises = [];

    // Invoke the model with the defined prompts.
    for (const prompt of prompts) {
      promises.push(invoke(events, prompt));
    }

    // Wait for all the promises to resolve.
    const results = await Promise.all(promises);
    
    // Update the cloud event with the new ontology.
    for (const result of results) {
      await classifier.update(result.data, result.prompt, event);
    }

    return (event);
  }

  /**
   * @param record the SQS record to process that contains
   * the EventBridge event providing information about the
   * S3 event.
   */
  async recordHandler(record: SQSRecord): Promise<CloudEvent> {
    return (await this.processEvent(
      CloudEvent.from(record.body)
    ));
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   * @param context the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handler(event: SQSEvent, _: Context) {
    return (await processPartialResponse(
      event, this.recordHandler.bind(this), processor
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);
