---
title: Titan Images
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.1.4
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/bedrock-image-generators
</span>
<br />

---

The Bedrock image generators package enables developers to use image generation models hosted on [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html), and create images at scale within their pipelines. The Amazon Titan image generator is part of this package and makes it possible to generate images from text, realize image inpainting and outpainting, as well as image-to-image variation.

---

### 🖼️ Text-to-Image

To generate images as part of your pipelines from a text prompt, you can use the `TitanImageGenerator` construct. This construct either takes the content of input text document as a prompt for generating an image, allowing you to nicely chain documents together, or can also take a user-provided prompt.

> ℹ️ The below example demonstrates how to use the Titan image generator to create images from an arbitrary prompt every 5 minutes, using the [Scheduler Trigger](/triggers/scheduler-event-trigger).

```typescript
import * as scheduler from '@aws-cdk/aws-scheduler-alpha';
import { SchedulerEventTrigger } from '@project-lakechain/scheduler-event-trigger';
import { SdxlImageGenerator } from '@project-lakechain/bedrock-image-generators';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    const trigger = new SchedulerEventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withScheduleExpression(
        scheduler.ScheduleExpression.rate(cdk.Duration.minutes(5))
      )
      .build();

    // Every 5 minutes, generate a new image.
    trigger.pipe(new TitanImageGenerator.Builder()
      .withScope(this)
      .withIdentifier('TitanImageGenerator')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withTask(new TextToImageTask.Builder()
        .withPrompt('A beautiful sunset over the ocean.')
        .withNegativePrompt('low resolution, low quality')
        .build()
      )
      .build());
  }
}
```

<br />
<br />

---

### 🧑‍🎨 Image Inpainting

The Titan model supports image inpainting by painting with an AI generated image an area of an image delimited by a *mask*.

![Inpainting Process](../../../assets/titan-inpainting-process.png)

To implement inpainting within a pipeline, you can use the `TitanImageGenerator` by specifying a source image
and a mask prompt. Mask prompts identify the area to be painted in natural language, such as "house" or "window".

> 💁 In the below example we create a pipeline that triggers when an image is uploaded to a source S3 bucket,
and replace any *house* detected in the image by a "*Modern house*".

```typescript
import { TitanImageGenerator, ImageInpaintingTask } from '@project-lakechain/bedrock-image-generators';

const imageGenerator = new TitanImageGenerator.Builder()
  .withScope(this)
  .withIdentifier('ImageGenerator')
  .withCacheStorage(cache)
  .withSource(source) // 👈 Specify a data source.
  .withTask(new ImageInpaintingTask.Builder()
    .withTextPrompt('Modern house')
    .withMaskPrompt('house')
    .build()
  )
  .build()
```

<br />
<br />

---

### 🎨 Image Outpainting

The Amazon Titan image model also supports outpainting, relative to a mask prompt. Image outpainting refers to painting an existing image outside of the area delimited by the mask image.

![Outpainting Process](../../../assets/titan-outpainting-process.png)

> 💁 In the below example we create a pipeline that triggers when an image is uploaded to a source S3 bucket,
and replaces the environment outside of a *house* with a "*beautiful garden and swimming pool*".

```typescript
import { TitanImageGenerator, ImageOutpaintingTask } from '@project-lakechain/bedrock-image-generators';

const imageGenerator = new TitanImageGenerator.Builder()
  .withScope(this)
  .withIdentifier('ImageGenerator')
  .withCacheStorage(cache)
  .withSource(source) // 👈 Specify a data source.
  .withTask(new ImageOutpaintingTask.Builder()
    .withTextPrompt('Beautiful garden and swimming pool')
    .withMaskPrompt('house')
    .build()
  )
  .build();
```

<br />
<br />

---

### ✨ Image Variation

The Titan model also supports taking an image as an input, and transforming that image using a textual prompt into a new image.

![Variation Process](../../../assets/titan-image-variation-process.png)

To perform image variation, you use the `TitanImageGenerator` and provide it with a `ImageVariationTask`.

```typescript
import { TitanImageGenerator, ImageVariationTask } from '@project-lakechain/bedrock-image-generators';

const imageGenerator = new TitanImageGenerator.Builder()
  .withScope(this)
  .withIdentifier('ImageGenerator')
  .withCacheStorage(cache)
  .withSource(trigger)
  .withSource(source) // 👈 Specify a data source.
  .withTask(new ImageVariationTask.Builder()
    .withTextPrompt('A cat smiling')
    // Reference the current document in the pipeline.
    .withImage(r.reference(r.document()))
    .build()
  )
  .build();
```

<br />
<br />

---

### 🌐 Region Selection

You can specify the AWS region in which you want to invoke Amazon Bedrock using the `.withRegion` API.

> 💁 By default, the middleware will use the current region in which it is deployed.

```typescript
import { TitanImageGenerator } from '@project-lakechain/bedrock-image-generators';

const imageGenerator = new TitanImageGenerator.Builder()
  .withScope(this)
  .withIdentifier('ImageGenerator')
  .withCacheStorage(cache)
  .withSource(trigger)
  .withRegion('us-east-1') // 👈 Alternate region
  .withTask(task)
  .build();
```

<br />
<br />

---

### ⚙️ Model Parameters

For the different tasks supported by the `TitanImageGenerator`, you can specify additional parameters to customize the generation of the images. You pass additional parameters using the `.withImageGenerationParameters` API on the task to execute.

```typescript
import {
  TitanImageGenerator,
  ImageOutpaintingTask,
  ImageGenerationParameters
} from '@project-lakechain/bedrock-image-generators';

const imageGenerator = new TitanImageGenerator.Builder()
  .withScope(this)
  .withIdentifier('ImageGenerator')
  .withCacheStorage(cache)
  .withSource(source)
  .withTask(new ImageOutpaintingTask.Builder()
    .withTextPrompt('Beautiful garden and swimming pool')
    .withMaskPrompt('house')
    .withImageGenerationParameters(new ImageGenerationParameters.Builder()
      .withQuality('premium')
      .withNumberOfImages(10)
      .build()
    )
    .build()
  )
  .build();
```

<br />

#### Parameters

Below are the parameters you can pass to the image generation tasks. See the [official Titan documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html) to understand the effect of available parameters.

| Parameter | Description | Default |
| --------- | ----------- | ------- |
| `numberOfImages` | The number of images to generate. | 1 |
| `quality` | The quality of the generated images. | standard |
| `cfgScale` | Specifies how strongly the generated image should adhere to the prompt. | 8.0 |
| `height` | The height of the generated image. | 1024 |
| `width` | The width of the generated image. | 1024 |
| `seed` | Determines the initial noise setting. | 0 |

<br />
<br />

---

### 🏗️ Architecture

This middleware is based on a Lambda compute and interacts with the Amazon Bedrock service in the specified
region to generate images.

![Architecture](../../../assets/sdxl-image-generator-architecture.png)

<br />

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ---------- | ----------- |
| `text/plain` | Text document |
| `image/png` | Image document |
| `image/jpeg` | Image document | 
| `application/json+scheduler` | Scheduler event |

##### Supported Outputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `image/png` | Image document |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br />

---

### 📖 Examples

- [Titan Inpainting Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/image-inpainting-pipelines/amazon-titan-inpainting-pipeline) - An example showcasing how to perform image inpainting using Amazon Titan.
- [Image Outpainting Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/image-outpainting-pipeline) - An example showcasing how to perform image outpainting using Amazon Titan.
