---
title: Cohere
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.1.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/bedrock-text-processors
</span>
<br>

---

*Bedrock text processors expose different constructs that leverage the Generative AI text models powered by [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html). Using these constructs, you can use prompt engineering techniques to transform text documents, including, text summarization, text translation, information extraction, and more!*

The Cohere text processor is part of the Bedrock text processors and allows you to leverage machine-learning models provided by Cohere within your pipelines.

---

### 🤖 Text Generation

To start using Cohere models in your pipelines, you import the `CohereTextProcessor` construct in your CDK stack, and specify the specific text model you want to use.

> 💁 The below example demonstrates how to use the Cohere text processor to summarize input documents uploaded to an S3 bucket.

```typescript
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { CohereTextProcessor, CohereTextModel } from '@project-lakechain/bedrock-text-processors';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    const cache = new CacheStorage(this, 'Cache');

    // Create the S3 event trigger.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(bucket)
      .build();

    // Transforms input documents using a Cohere model.
    const cohere = new CohereTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('CohereTextProcessor')
      .withCacheStorage(cache)
      .withSource(source)
      .withModel(CohereTextModel.COHERE_COMMAND_TEXT_V14)
      .withPrompt(`
        Give a detailed summary of the text with the following constraints:
        - Write the summary in the same language as the original text.
        - Keep the original meaning, style, and tone of the text in the summary.
      `)
      .withModelParameters({
        max_tokens: 4096
      })
      .build();
  }
}
```

<br>

---

### 🤖 Model Selection

You can select the specific Cohere model to use with this middleware using the `.withModel` API.

```typescript
import { CohereTextProcessor, CohereTextModel } from '@project-lakechain/bedrock-text-processors';

const cohere = new CohereTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('CohereTextProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withModel(CohereTextModel.COHERE_COMMAND_LIGHT_TEXT_V14) // 👈 Specify a model
  .withPrompt(prompt)
  .build();
```

You can choose amongst the following models : `COHERE_COMMAND_TEXT_V14`, and `COHERE_COMMAND_LIGHT_TEXT_V14`.

<br>

---

### 🌐 Region Selection

You can specify the AWS region in which you want to invoke Amazon Bedrock using the `.withRegion` API. This can be helpful if Amazon Bedrock is not yet available in your deployment region.

> 💁 By default, the middleware will use the current region in which it is deployed.

```typescript
import { CohereTextProcessor, CohereTextModel } from '@project-lakechain/bedrock-text-processors';

const cohere = new CohereTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('CohereTextProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withRegion('eu-central-1') // 👈 Alternate region
  .withModel(CohereTextModel.COHERE_COMMAND_TEXT_V14)
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
