---
title: AI21
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.3.4
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/bedrock-text-processors
</span>
<br>

---

*Bedrock text processors expose different constructs that leverage the Generative AI text models powered by [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html). Using these constructs, you can use prompt engineering techniques to transform text documents, including, text summarization, text translation, information extraction, and more!*

The AI21 text processor is part of the Bedrock text processors and allows you to leverage machine-learning models provided by AI21 Labs within your pipelines.

---

### 🤖 Text Generation

To start using AI21 models in your pipelines, you import the `AI21TextProcessor` construct in your CDK stack, and specify the specific text model you want to use.

> 💁 The below example demonstrates how to use the AI21 text processor to summarize input documents uploaded to an S3 bucket.

```typescript
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { AI21TextProcessor, AI21TextModel } from '@project-lakechain/bedrock-text-processors';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    const cache = new CacheStorage(this, 'Cache');

    // Monitor the S3 bucket for new documents.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(bucket)
      .build();

    // Transforms input documents using an AI21 model.
    const ai21 = new AI21TextProcessor.Builder()
      .withScope(this)
      .withIdentifier('AI21TextProcessor')
      .withCacheStorage(cache)
      .withSource(source)
      .withModel(AI21TextModel.AI21_J2_ULTRA_V1)
      .withPrompt(`
        Give a detailed summary of the text with the following constraints:
        - Write the summary in the same language as the original text.
        - Keep the original meaning, style, and tone of the text in the summary.
      `)
      .withModelParameters({
        maxTokens: 8191
      })
      .build();
  }
}
```

<br>

---

### 🤖 Model Selection

You can select the specific AI21 model to use using the `.withModel` API.

```typescript
import { AI21TextProcessor, AI21TextModel } from '@project-lakechain/bedrock-text-processors';

const ai21 = new AI21TextProcessor.Builder()
  .withScope(this)
  .withIdentifier('AI21TextProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withModel(AI21TextModel.AI21_J2_MID_V1) // 👈 Specify a model
  .withPrompt(prompt)
  .build();
```

You can use the following models : `AI21_J2_ULTRA_V1`, and `AI21_J2_MID_V1`.

<br>

---

### 🌐 Region Selection

You can specify the AWS region in which you want to invoke Amazon Bedrock using the `.withRegion` API.  This can be helpful if Amazon Bedrock is not yet available in your deployment region.

> 💁 By default, the middleware will use the current region in which it is deployed.

```typescript
import { AI21TextProcessor, AI21TextModel } from '@project-lakechain/bedrock-text-processors';

const ai21 = new AI21TextProcessor.Builder()
  .withScope(this)
  .withIdentifier('AI21TextProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withRegion('eu-central-1') // 👈 Alternate region
  .withModel(AI21TextModel.AI21_J2_MID_V1)
  .withPrompt(prompt)
  .build();
```

<br>

---

### ⚙️ Model Parameters

You can forward specific parameters to text models using the `.withModelParameters` method. See the [Bedrock Inference Parameters](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html) for more information on the parameters supported by the different models.

<br>

---

### 🏗️ Architecture

This middleware is based on a Lambda compute running on an ARM64 architecture, and integrate with Amazon Bedrock to generate text based on the given prompt and input documents.

![Architecture](../../../assets/bedrock-text-generators-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | UTF-8 text documents. |
| `text/markdown` | Markdown documents. |
| `text/csv` | CSV documents. |
| `text/html` | HTML documents. |
| `application/x-subrip` | SubRip subtitles. |
| `text/vtt` | Web Video Text Tracks (WebVTT) subtitles. |
| `application/json` | JSON documents. |
| `application/json+scheduler` | Used by the `Scheduler` middleware. |

##### Supported Outputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | UTF-8 text documents. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Text Generation Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/text-generation-pipeline) - An example showcasing how to generate text using Amazon Bedrock models.
