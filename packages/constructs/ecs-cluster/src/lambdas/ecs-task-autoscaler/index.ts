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

import { Context } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import {
  DescribeTasksCommand,
  ECSClient,
  ListTasksCommand,
  RunTaskCommand,
  Task
} from '@aws-sdk/client-ecs';

/**
 * Environment variables.
 */
const CONTAINER_SQS_QUEUE_URL = process.env.CONTAINER_SQS_QUEUE_URL as string;
const ECS_CLUSTER_ARN = process.env.ECS_CLUSTER_ARN as string;
const ECS_TASK_DEFINITION_ARN = process.env.ECS_TASK_DEFINITION_ARN as string;
const CAPACITY_PROVIDER_NAME = process.env.CAPACITY_PROVIDER_NAME as string;
const MAX_TASK_NUMBER = process.env.MAX_TASK_NUMBER ? parseInt(process.env.MAX_TASK_NUMBER) : 5;
const MESSAGES_PER_TASK = process.env.MESSAGES_PER_TASK ? parseInt(process.env.MESSAGES_PER_TASK) : 10;

/**
 * The SQS client.
 */
const sqs = tracer.captureAWSv3Client(
  new SQSClient({ region: process.env.AWS_REGION })
);

/**
 * The ECS client.
 */
const ecs = tracer.captureAWSv3Client(
  new ECSClient({ region: process.env.AWS_REGION })
);

/**
 * The list of states for an ECS task
 * we consider as `pending`.
 */
const pendingStates = [
  'PENDING',
  'PROVISIONING',
  'ACTIVATING',
];

/**
 * The list of states for an ECS task
 * we consider as `running`.
 */
const runningStates = [
  'RUNNING'
];

/**
 * Describes the result of a task details retrieval
 * which categorizes tasks into running and pending
 * tasks.
 */
export interface TaskDetails {
  running: Task[];
  pending: Task[];
}

/**
 * The lambda class definition containing the lambda handler.
 */
class Lambda implements LambdaInterface {

  /**
   * Runs the specified number of tasks on the ECS cluster.
   * @param taskNumber the number of tasks to run.
   * @returns a promise that resolves when all the tasks
   * have been started.
   */
  runTasks(taskNumber: number): Promise<any> {
    // Create an ECS task to process the document.
    return (ecs.send(new RunTaskCommand({
      cluster: ECS_CLUSTER_ARN,
      taskDefinition: ECS_TASK_DEFINITION_ARN,
      capacityProviderStrategy: [{
        capacityProvider: CAPACITY_PROVIDER_NAME,
        base: 0,
        weight: 1
      }],
      count: taskNumber
    })));
  }

  /**
   * A rudimentary algorithm to calculate the number of tasks
   * to start based on the number of visible messages on the
   * target SQS queue and the number of running tasks in the
   * target ECS cluster.
   *
   * The main objective of this algorithm is to be able to scale
   * tasks much faster than we would using an alarm and an ECS
   * service.
   * The algorithm is based on the number of messages that each
   * task can process simultaneously, while also avoiding to start too
   * many tasks at once.
   *
   * @param sqsVisibleMessages the number of visible messages
   * on the target SQS queue.
   * @param currentTasksRunning the number of running tasks
   * in the target ECS cluster.
   * @param currentTasksPending the number of pending tasks
   * in the target ECS cluster.
   * @returns the number of tasks to start.
   */
  calculateTasksToRun(
    sqsVisibleMessages: number,
    currentTasksRunning: number,
    currentTasksPending: number
  ) {
    const currentTasksScheduled = currentTasksRunning + currentTasksPending;

    // If there are no visible messages on the SQS queue,
    // it means that there either are no documents to process,
    // or the pressure on the consumers is low.
    if (sqsVisibleMessages === 0) {
      return (0);
    }

    // If the number of scheduled tasks is equal or higher
    // than the maximum expected number of tasks, there is
    // no need to run new tasks.
    if (currentTasksScheduled >= MAX_TASK_NUMBER) {
      return (0);
    }

    // The compute potential of tasks which are currently
    // pending execution. It is important to take into account
    // the compute potential of pending tasks in order to avoid
    // starting too many tasks at once.
    const pendingTasksPotential = currentTasksPending * MESSAGES_PER_TASK;

    // If there is no compute potential in the pending tasks,
    // we need to start new tasks proportionally to the number
    // of visible messages on the SQS queue.
    if (pendingTasksPotential === 0) {
      return (Math.min(
        Math.ceil(sqsVisibleMessages / MESSAGES_PER_TASK),
        MAX_TASK_NUMBER - currentTasksScheduled
      ));
    }

    // If there is compute potential in the pending tasks,
    // we take into account the remaining potential in the
    // calculation of the number of tasks to run.
    return (Math.min(
      Math.floor(sqsVisibleMessages / pendingTasksPotential),
      MAX_TASK_NUMBER - currentTasksScheduled
    ));
  }

  /**
   * @param taskArns the list of task ARNs to retrieve details for.
   * @returns a promise that resolves an array of both running and
   * pending tasks.
   */
  async getTasksDetails(taskArns: string[]): Promise<TaskDetails> {
    const tasks = (await ecs.send(new DescribeTasksCommand({
      cluster: ECS_CLUSTER_ARN,
      tasks: taskArns
    }))).tasks ?? [];

    // We group the tasks by status, categorizing them into
    // pending and running tasks.
    return (tasks.reduce((acc: TaskDetails, task: Task) => {
      if (runningStates.includes(task.lastStatus ?? '')) {
        acc.running.push(task);
      } else if (pendingStates.includes(task.lastStatus ?? '')) {
        acc.pending.push(task);
      }
      return (acc);
    }, { running: [], pending: [] }));
  }

  /**
   * The Lambda entry point.
   * @param event the received CloudWatch event.
   * @param context the Lambda context.
   */
  @tracer.captureLambdaHandler({ captureResponse: false })
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: any, context: Context) {
    // Detailed statistics about tasks.
    let tasksRunning = 0;
    let tasksPending = 0;

    // Retrieve the number of messages visible on the target
    // SQS queue and the number of running tasks in the target
    // ECS cluster.
    const results = await Promise.all([
      sqs.send(new GetQueueAttributesCommand({
        QueueUrl: CONTAINER_SQS_QUEUE_URL,
        AttributeNames: ['ApproximateNumberOfMessages']
      })),
      ecs.send(new ListTasksCommand({
        cluster: ECS_CLUSTER_ARN,
        desiredStatus: 'RUNNING'
      }))
    ]);

    // Extract the number of visible messages on the SQS queue.
    const sqsVisibleMessages = parseInt(
      results[0].Attributes?.ApproximateNumberOfMessages as string
    );

    // The tasks scheduled on the cluster.
    const tasksScheduled = results[1].taskArns ?? [];

    // If there are currently scheduled tasks on the
    // cluster, we retrieve their details to be able to
    // distinguish between running and pending tasks.
    if (tasksScheduled.length > 0) {
      const tasksDetails = await this.getTasksDetails(tasksScheduled);
      tasksRunning = tasksDetails.running.length;
      tasksPending = tasksDetails.pending.length;
    }

    // Calculate the number of tasks to run.
    const tasksToRun = this.calculateTasksToRun(
      sqsVisibleMessages,
      tasksRunning,
      tasksPending
    );

    logger.info(
      `Tasks to run: ${tasksToRun}, Tasks running: ${tasksRunning}, Tasks pending: ${tasksPending}, visible messages: ${sqsVisibleMessages}`
    );

    return (tasksToRun ? await this.runTasks(tasksToRun) : Promise.resolve());
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);
