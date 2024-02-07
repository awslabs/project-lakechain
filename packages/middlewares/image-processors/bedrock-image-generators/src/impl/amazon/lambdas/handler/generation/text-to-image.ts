import { CloudEvent } from '@project-lakechain/sdk';
import { tracer } from '@project-lakechain/sdk/powertools';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { TextToImageProps } from '../../../definitions/tasks';

/**
 * Environment variables.
 */
const IMAGE_MODEL = process.env.IMAGE_MODEL as string;

/**
 * The Bedrock runtime.
 */
const bedrock = tracer.captureAWSv3Client(new BedrockRuntime({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Executes the given text to image task.
 * @param event the document event.
 * @param task the task to execute.
 * @returns a promise that resolves to a collection of image
 * buffers.
 */
export const textToImage = async (event: CloudEvent, task: TextToImageProps) => {  
  // Generate the image(s).
  const response = await bedrock.invokeModel({
    body: JSON.stringify({
      taskType: task.taskType,
      textToImageParams: {
        text: await event.resolve(task.text),
        negativeText: task.negativeText ?
          await event.resolve(task.negativeText) :
          undefined
      },
      imageGenerationConfig: task.imageGenerationParameters
    }),
    modelId: IMAGE_MODEL,
    accept: 'application/json',
    contentType: 'application/json'
  });

  // Parse the response as a JSON object.
  const value = JSON.parse(response.body.transformToString());

  // Store the resulting images as a collection of buffer.
  return (value.images.map((image: any) => Buffer.from(image, 'base64')));
};