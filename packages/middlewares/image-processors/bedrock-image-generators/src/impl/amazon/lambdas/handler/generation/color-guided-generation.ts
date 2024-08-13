import { CloudEvent } from '@project-lakechain/sdk';
import { tracer } from '@project-lakechain/sdk/powertools';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { ColorGuidedGenerationProps } from '../../../definitions/tasks';

/**
 * The Bedrock runtime.
 */
const bedrock = tracer.captureAWSv3Client(new BedrockRuntime({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Executes the given color guided generation task.
 * @param event the document event.
 * @param model the model to use.
 * @param task the task to execute.
 * @returns a promise that resolves to a collection of image
 * buffers.
 */
export const colorGuidedGeneration = async (event: CloudEvent, model: string, task: ColorGuidedGenerationProps) => {
  const response = await bedrock.invokeModel({
    body: JSON.stringify({
      taskType: task.taskType,
      colorGuidedGenerationParams: {
        text: await event.resolve(task.text),
        negativeText: task.negativeText ?
          await event.resolve(task.negativeText) :
          undefined,
        referenceImage: task.referenceImage ?
          (await event.resolve(task.referenceImage)).toString('base64') :
          undefined,
        colors: task.colors
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