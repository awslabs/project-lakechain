---
title: Transformers Summarizer
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.4.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/transformers-text-summarizer">
    @project-lakechain/transformers-text-summarizer
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The Transformers summarizer allows to run [Huggingface summarizer models](https://huggingface.co/models?pipeline_tag=summarization) on AWS performing abstractive summarization on text documents.

> 💁 Abstractive summarization is the task of summarizing a text document by generating a shorter version of it that captures the most important information from the original document. It is different from extractive summarization, which selects passages from the original document to create the summary.

---

### 📝 Summarizing Text

To use this middleware, you import it in your CDK stack and connect it to a data source that provides text documents, such as the [S3 Trigger](/project-lakechain/triggers/s3-event-trigger) if your text documents are stored in S3.

> ℹ️ The below example shows how to create a pipeline that summarizes text documents uploaded to an S3 bucket.

```typescript
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { TransformersTextSummarizer } from '@project-lakechain/transformers-text-summarizer';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'VPC', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');
    
    // Create the S3 event trigger.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(bucket)
      .build();
    
    // Summarize uploaded text documents.
    trigger.pipe(new TransformersTextSummarizer.Builder()
      .withScope(this)
      .withIdentifier('TransformersTextSummarizer')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withVpc(vpc)
      .build());
  }
}
```

<br>

---

#### Summarizer Model

By default, this middleware runs the [`facebook/bart-large-cnn`](https://huggingface.co/facebook/bart-large-cnn) summarizer model. You can however customize the summarizer model that is going to be used using the `.withModel` API.

```typescript
import { TransformersTextSummarizer, SummarizationTransformersModel } from '@project-lakechain/transformers-text-summarizer';

const summarizer = new TransformersTextSummarizer.Builder()
  .withScope(this)
  .withIdentifier('TransformersTextSummarizer')
  .withCacheStorage(cache)
  .withSource(source)
  .withVpc(vpc)
  .withModel(
    SummarizationTransformersModel.DISTILBART_CNN_12_6
  )
  .build();
```

<br>

---

#### Escape Hatches

Several HuggingFace models are already referenced in the `SummarizationTransformersModel` class. You can however reference an arbitrary Huggingface model as well.

```typescript
import { TransformersTextSummarizer, SummarizationTransformersModel } from '@project-lakechain/transformers-text-summarizer';

const summarizer = new TransformersTextSummarizer.Builder()
  .withScope(this)
  .withIdentifier('TransformersTextSummarizer')
  .withCacheStorage(cache)
  .withSource(source)
  .withVpc(vpc)
  .withModel(SummarizationTransformersModel.of(
    'google/bigbird-pegasus-large-arxiv'
  ))
  .build();
```

<br>

---

#### Chunk Size

This middleware will automatically split the text documents into chunks of specific size, and will summarize each chunk individually to stay within the attention limits of the summarizer model. You can customize the chunk size that is passed to the summarizer model using the `.withChunkSize` API.

> 💁 The default chunk size is `4000` bytes.

```typescript
import { TransformersTextSummarizer } from '@project-lakechain/transformers-text-summarizer';

const summarizer = new TransformersTextSummarizer.Builder()
  .withScope(this)
  .withIdentifier('TransformersTextSummarizer')
  .withCacheStorage(cache)
  .withSource(source)
  .withVpc(vpc)
  .withChunkSize(512) // 👈 Specify a chunk size
  .build();
```

<br>

---

### 🏗️ Architecture

This middleware supports both `CPU` and `GPU` compute types. We implemented 2 different architectures, one that's GPU based and using ECS, the other which is CPU based and serverless, based on AWS Lambda. You can use the [`.withComputeType`](/project-lakechain/guides/api#compute-types) API to select the compute type you want to use.

> 💁 By default, this implementation will run on the `CPU` compute type.

#### GPU Architecture

The GPU architecture leverages AWS ECS to run the summarization process on [`g4dn.xlarge`](https://aws.amazon.com/ec2/instance-types/g4/) instances. The GPU instance is part of a ECS cluster, and the cluster is part of a VPC, running within its private subnets.

![Transformers Summarizer GPU Architecture](../../../assets/transformers-text-summarizer-gpu-architecture.png)

#### CPU Architecture

The CPU architecture leverages AWS Lambda to run the summarization process on serverless compute. The Lambda function runs as part of a VPC and is integrated with AWS EFS to cache the Transformers model(s).

![Transformers Summarizer CPU Architecture](../../../assets/transformers-text-summarizer-cpu-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | UTF-8 text documents. |

##### Supported Outputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | UTF-8 text documents. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware supports CPU compute. |
| `GPU` | This middleware supports GPU compute. |

<br>

---

### 📖 Examples

- [Abstractive Summarization Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/summarization-pipelines/abstractive-summarization-pipeline/) - Builds a pipeline for text summarization using Transformers models.
