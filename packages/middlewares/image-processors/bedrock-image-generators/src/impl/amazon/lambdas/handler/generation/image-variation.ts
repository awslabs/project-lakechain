import { CloudEvent } from '@project-lakechain/sdk';
import { tracer } from '@project-lakechain/sdk/powertools';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { ImageVariationProps } from '../../../definitions/tasks';

/**
 * The Bedrock runtime.
 */
const bedrock = tracer.captureAWSv3Client(new BedrockRuntime({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Executes the given image variation task.
 * @param event the document event.
 * @param task the task to execute.
 * @returns a promise that resolves to a collection of image
 * buffers.
 */
export const imageVariation = async (event: CloudEvent, model: string, task: ImageVariationProps) => {
  const response = await bedrock.invokeModel({
    body: JSON.stringify({
      taskType: task.taskType,
      imageVariationParams: {
        images: [
          (await event.resolve(task.image)).toString('base64')
        ],
        text: task.text ?
          await event.resolve(task.text) :
          undefined,
        negativeText: task.negativeText ?
          await event.resolve(task.negativeText) :
          undefined,
        similarityStrength: task.similarityStrength
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