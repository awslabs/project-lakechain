import { CloudEvent } from '@project-lakechain/sdk';
import { tracer } from '@project-lakechain/sdk/powertools';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { ImageOutpaintingProps } from '../../../definitions/tasks';

/**
 * The Bedrock runtime.
 */
const bedrock = tracer.captureAWSv3Client(new BedrockRuntime({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Executes the given image outpainting task.
 * @param event the document event.
 * @param model the model to use.
 * @param task the task to execute.
 * @returns a promise that resolves to a collection of image
 * buffers.
 */
export const imageOutpainting = async (event: CloudEvent, model: string, task: ImageOutpaintingProps) => {
  const response = await bedrock.invokeModel({
    body: JSON.stringify({
      taskType: task.taskType,
      outPaintingParams: {
        image: (await event.resolve(task.image)).toString('base64'),
        text: await event.resolve(task.text),
        negativeText: task.negativeText ?
          await event.resolve(task.negativeText) :
          undefined,
        maskPrompt: task.maskPrompt ?
          await event.resolve(task.maskPrompt) :
          undefined,
        maskImage: task.maskImage ?
          (await event.resolve(task.maskImage)).toString('base64') :
          undefined
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