---
title: Ollama
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.4.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/ollama-processor
</span>
<br>

---

The Ollama processor makes it possible to run the large-language models and image models supported by [Ollama](https://ollama.com/) on AWS within a customer VPC.

Using this middleware, customers can transform their text documents (e.g summarization, translation, topic modeling, etc.) as well as extract meaningful information from their image documents.

> 💁 You can view the list of models supported by Ollama [here](https://ollama.com/library).

---

### 🦙 Running Ollama

To use this middleware, you import it in your CDK stack and connect it to a data source that provides text or image documents.

> ℹ️ The below example shows how to create a pipeline that summarizes text documents uploaded to an S3 bucket.

```typescript
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { CacheStorage } from '@project-lakechain/core';
import {
  OllamaProcessor,
  OllamaModel,
  InfrastructureDefinition
} from '@project-lakechain/ollama-processor';

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
    trigger.pipe(new OllamaProcessor.Builder()
      .withScope(this)
      .withIdentifier('OllamaProcessor')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withModel(OllamaModel.LLAMA2)
      .withPrompt('Give a detailed summary of the provided document.')
      .withInfrastructure(new InfrastructureDefinition.Builder()
        .withMaxMemory(180_000)
        .withGpus(8)
        .withInstanceType(ec2.InstanceType.of(
          ec2.InstanceClass.G5,
          ec2.InstanceSize.XLARGE48
        ))
        .build())
      .build());
  }
}
```

<br>

---

### 🤖 Model Selection

Ollama supports a variety of models, and you can specify the model and optionally the specific tag to use.

> 💁 When no tag is provided, the `latest` tag is used. The example below showcases how to use a specific tag on a model.

```typescript
import { OllamaProcessor, OllamaModel } from '@project-lakechain/ollama-processor';

const ollama = new OllamaProcessor.Builder()
  .withScope(this)
  .withIdentifier('OllamaProcessor')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withModel(OllamaModel.LLAMA2.tag('13b')) // 👈 Specify a model and tag.
  .withPrompt(prompt)
  .withInfrastructure(infrastructure)
  .build();
```

<br>

---

#### Escape Hatch

The `OllamaModel` class provides a quick way to reference existing models, and select a specific tag. However, as Ollama adds new models, you may find yourself in a situation where such as model is not yet referenced by this middleware.

To address this situation, you can manually specify a model definition pointing to the supported Ollama model you wish to run. You do so by specifying the name of the model in the ollama library, the tag you wish to use, and its input and output mime-type.

> 💁 In the example below, we redefine the `llava` image model and its inputs and outputs.

```typescript
import { OllamaProcessor, OllamaModel } from '@project-lakechain/ollama-processor';

const ollama = new OllamaProcessor.Builder()
  .withScope(this)
  .withIdentifier('OllamaProcessor')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withModel(OllamaModel.of('llava', {
    tag: 'latest',
    inputs: ['image/png', 'image/jpeg'],
    outputs: ['text/plain']
  }))
  .withPrompt(prompt)
  .withInfrastructure(infrastructure)
  .build();
```

<br>

---

### 🌉 Infrastructure

Every model requires a specific infrastructure to run optimally. To ensure the `OllamaProcessor` orchestrates your models using the most optimal instance, memory, and GPU allocation, you need to specify an infrastructure definition.

> 💁 The example below describes the infrastructure suited to run the `Mixtral` model requiring significant RAM and GPU memory to run.

```typescript
const ollama = new OllamaProcessor.Builder()
  .withScope(this)
  .withIdentifier('OllamaProcessor')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withModel(OllamaModel.MIXTRAL)
  .withPrompt(prompt)
  .withInfrastructure(new InfrastructureDefinition.Builder()
    .withMaxMemory(180_000)
    .withGpus(8)
    .withInstanceType(ec2.InstanceType.of(
      ec2.InstanceClass.G5,
      ec2.InstanceSize.XLARGE48
    ))
    .build())
  .build();
```

Below is a description of the fields associated with the infrastructure definition.

| Field | Description |
| ----- | ----------- |
| `maxMemory` | The maximum RAM in MiB to allocate to the container. |
| `gpus` | The number of GPUs to allocate to the container. |
| `instanceType` | The EC2 instance type to use for running the container. |

<br>

---

### 🏗️ Architecture

The Ollama processor can run on either CPU or GPU compute. It packages the Ollama server, and a small Python application running the inference, within a Docker container. To orchestrate deployments, this middleware deploys an ECS auto-scaled cluster of containers that consume documents from the middleware input queue. The cluster is deployed in the private subnet of the given VPC, and caches the models on an EFS storage to optimize cold-starts.

> ℹ️ The average cold-start for the Ollama containers is around 3 minutes when no instances are running.

![Ollama Processor Architecture](../../../assets/ollama-processor-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

*The supported inputs depend on the specific Ollama model used. The [model definitions](https://github.com/awslabs/project-lakechain/blob/main/packages/middlewares/text-processors/ollama-processor/src/definitions/model.ts) describe the supported inputs and outputs for each model.*

##### Supported Outputs

*The supported outputs depend on the specific Ollama model used. The [model definitions](https://github.com/awslabs/project-lakechain/blob/main/packages/middlewares/text-processors/ollama-processor/src/definitions/model.ts) describe the supported inputs and outputs for each model.*

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware supports CPU compute. |
| `GPU` | This middleware supports GPU compute. |

<br>

---

### 📖 Examples

- [Ollama Summarization Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/summarization-pipelines/ollama-summarization-pipeline) - Builds a pipeline for text summarization using Ollama.
