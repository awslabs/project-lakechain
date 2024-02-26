---
title: Sentence Transformers
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.4.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/sentence-transformers
</span>
<br>

---

The Sentence Transformers middleware enables customers to run [Sentence Transformers](https://huggingface.co/sentence-transformers) embedding models within their AWS account to create vector embeddings for text and markdown documents. It deploys an auto-scaled cluster of GPU-enabled containers to process documents using one of the selected Sentence Transformers model, such that all the processing remains on customers AWS environment.

---

### 🤗 Embedding Documents

To use this middleware, you import it in your CDK stack and specify a VPC in which the processing cluster will be deployed. You will also need to optionally select the specific embedding model to use within the container.

> ℹ️ The below example shows how to deploy the Sentence Transformers middleware in a VPC using the [`all-mpnet-base-v2`](https://huggingface.co/sentence-transformers/all-mpnet-base-v2) model.

```typescript
import { SentenceTransformers, SentenceTransformersModel } from '@project-lakechain/sentence-transformers';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'Vpc', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');

    // Creates embeddings for text using Sentence Transformers
    // models.
    const sentenceTransformers = new SentenceTransformers.Builder()
      .withScope(this)
      .withIdentifier('SentenceTransformers')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(source) // 👈 Specify a data source
      // Optionally specify an embedding model to use.
      .withModel(SentenceTransformersModel.ALL_MPNET_BASE_V2)
      .build();
  }
}
```

<br>

---

#### Custom Model

There are several Sentence Transformers models that are referenced as part of the `SentenceTransformersModel` class that you can select out of the box. You can also specify a custom model from [HuggingFace](https://huggingface.co/sentence-transformers) by providing the model name directly.

> ℹ️ The below example shows how to use a custom model.

```typescript
const sentenceTransformers = new SentenceTransformers.Builder()
  .withScope(this)
  .withIdentifier('SentenceTransformers')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withSource(source)
  // Optionally specify an embedding model to use.
  .withModel(SentenceTransformersModel.of('all-MiniLM-L6-v2'))
  .build();
```

<br>

---

#### Auto-Scaling

The cluster of containers deployed by this middleware will auto-scale based on the number of documents that need to be processed. The cluster scales up to a maximum of 5 instances by default, and scales down to zero when there are no documents to process.

> ℹ️ You can configure the maximum amount of instances that the cluster can auto-scale to by using the `withMaxInstances` method.

```typescript
const sentenceTransformers = new SentenceTransformers.Builder()
  .withScope(this)
  .withIdentifier('SentenceTransformers')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withSource(source)
  .withMaxInstances(10)
  .build();
```

<br>

---

### 📄 Output

The Sentence Transformers middleware does not modify or alter source documents in any way. It instead enriches the metadata of the documents with a pointer to the vector embedding that were created for the document.

<details>
  <summary>💁 Click to expand example</summary>

  ```json
  {
    "specversion": "1.0",
    "id": "1780d5de-fd6f-4530-98d7-82ebee85ea39",
    "type": "document-created",
    "time": "2023-10-22T13:19:10.657Z",
    "data": {
        "chainId": "6ebf76e4-f70c-440c-98f9-3e3e7eb34c79",
        "source": {
            "url": "s3://bucket/document.txt",
            "type": "text/plain",
            "size": 245328,
            "etag": "1243cbd6cf145453c8b5519a2ada4779"
        },
        "document": {
            "url": "s3://bucket/document.txt",
            "type": "text/plain",
            "size": 245328,
            "etag": "1243cbd6cf145453c8b5519a2ada4779"
        },
        "metadata": {
          "properties": {
            "kind": "text",
            "attrs": {
              "embeddings": {
                "vectors": "s3://cache-storage/sentence-transformers/45a42b35c3225085.json",
                "model": "all-mpnet-base-v2",
                "dimensions": 768
            }
          }
        }
      }
    }
  }
  ```

</details>

<br>

---

### ℹ️ Limits

Sentence Transformer models have limits on the number of input tokens they can process. For more information, you can consult the documentation of the specific model you are using to understand these limits.

> 💁 To limit the size of upstream text documents, we recommend to use a text splitter to chunk text documents before they are passed to this middleware, such as the [Recursive Character Text Splitter](/project-lakechain/text-splitters/recursive-character-text-splitter).

<br>

---

### 🏗️ Architecture

The Sentence Transformers middleware requires GPU-enabled instances ([g4dn.xlarge](https://aws.amazon.com/ec2/instance-types/g4)) to run the embedding models. To orchestrate deployments, it deploys an ECS auto-scaled cluster of containers that consume documents from the middleware input queue. The cluster is deployed in the private subnet of the given VPC, and caches the models on an EFS storage to optimize cold-starts.

> ℹ️ The average cold-start for the Sentence Transformers containers is around 3 minutes when no instances are running.

![Sentence Transformers Architecture](../../../assets/sentence-transformers-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | UTF-8 text documents. |
| `text/markdown` | UTF-8 markdown documents. |

##### Supported Outputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | UTF-8 text documents. |
| `text/markdown` | UTF-8 markdown documents. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Sentence Transformers Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/embedding-pipelines/sentence-transformers-pipeline) - An example showcasing how to create embeddings using Sentence Transformers.
