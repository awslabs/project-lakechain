---
title: KeyBERT
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.1.4
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/keybert-text-processor
</span>
<br>

---

This middleware is based on the [KeyBERT](https://github.com/MaartenGr/KeyBERT) keyword extraction and topic modeling library. It leverages the power of embedding models to identify the most significant keywords and topics in a text document, and to enrich the document metadata with them.

---

### 🏷️ Keyword Extraction

To use this middleware, you import it in your CDK stack and connect it to a data source that provides text documents, such as the [S3 Trigger](/triggers/s3-event-trigger) if your text documents are stored in S3.

```typescript
import { KeybertTextProcessor } from '@project-lakechain/keybert-text-processor';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'VPC', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');

    // Create the KeyBERT text processor.
    const keybert = new KeybertTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('Keybert')
      .withCacheStorage(cache)
      .withSource(source) // 👈 Specify a data source
      .withVpc(vpc)
      .build();
  }
}
```

<br>

---

#### Embedding Model

It is possible to customize the embedding model that KeyBERT is going to use to analyze input documents.

> ℹ️ At this time, only models from the [Sentence Transformers](https://huggingface.co/sentence-transformers) library are supported.

```typescript
import { KeybertTextProcessor, KeybertEmbeddingModel } from '@project-lakechain/keybert-text-processor';

const keybert = new KeybertTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('Keybert')
  .withCacheStorage(cache)
  .withSource(trigger)
  .withVpc(vpc)
  .withEmbeddingModel(
    KeybertEmbeddingModel.ALL_MPNET_BASE_V2
  )
  .build();
```

<br>

---

#### Options

There are different options influencing how the KeyBERT library extracts topics from input documents that you can optionally customize.

```typescript
const keybert = new KeybertTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('Keybert')
  .withCacheStorage(cache)
  .withSource(trigger)
  .withVpc(vpc)
  // The maximum number of keywords to extract.
  .withTopN(5)
  // Sets whether to use the max sum algorithm.
  .withUseMaxSum(false)
  // Sets the diversity of the results between 0 and 1.
  .withDiversity(0.5)
  // Sets the number of candidates to consider if `useMaxSum` is
  // et to `true`.
  .withCandidates(20)
  .build();
```

<br>

---

### 📄 Output

The KeyBERT text processor middleware does not modify or alter source documents in any way. It instead enriches the metadata of documents with a collection of topics extracted from their text.

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
          "url": "s3://bucket/text.txt",
          "type": "text/plain",
          "size": 24532,
          "etag": "1243cbd6cf145453c8b5519a2ada4779"
      },
      "document": {
          "url": "s3://bucket/text.txt",
          "type": "text/plain",
          "size": 24532,
          "etag": "1243cbd6cf145453c8b5519a2ada4779"
      },
      "metadata": {
        "keywords": ["ai", "machine learning", "nlp"]
      },
      "callStack": []
    }
  }
  ```

</details>

<br>

---

### 🏗️ Architecture

The KeyBERT middleware runs within a Lambda compute running the KeyBERT library packaged as a Docker container. The Lambda compute runs within a VPC, and caches KeyBERT embedding models on an EFS storage.

![Architecture](../../../assets/keybert-text-processor-architecture.png)

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
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Topic Modeling Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/topic-modeling-pipeline/) - An example showcasing how to extract relevant topics from text documents.
