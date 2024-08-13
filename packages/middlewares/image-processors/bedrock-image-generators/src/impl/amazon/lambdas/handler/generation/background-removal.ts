import { CloudEvent } from '@project-lakechain/sdk';
import { tracer } from '@project-lakechain/sdk/powertools';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { BackgroundRemovalProps } from '../../../definitions/tasks';

/**
 * The Bedrock runtime.
 */
const bedrock = tracer.captureAWSv3Client(new BedrockRuntime({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Executes the given background removal task.
 * @param event the document event.
 * @param model the model to use.
 * @param task the task to execute.
 * @returns a promise that resolves to a collection of image
 * buffers.
 */
export const backgroundRemoval = async (event: CloudEvent, model: string, task: BackgroundRemovalProps) => {
  const response = await bedrock.invokeModel({
    body: JSON.stringify({
      taskType: task.taskType,
      backgroundRemovalParams: {
        image: (await event.resolve(task.image)).toString('base64')
      },
      imageGenerationConfig: task.imageGenerationParameters
    }),
    modelId: model,
    accept: 'application/json',
    contentType: 'application/json'
  });

  // Parse the response as a JSON object.
  const value = JSON.parse(response.body.transformToString());

  // Store the resulting images as a collection of buffer.
  return (value.images.map((image: any) => Buffer.from(image, 'base64')));
};