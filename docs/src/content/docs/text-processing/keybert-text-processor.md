---
title: KeyBERT
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.8.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/keybert-text-processor">
    @project-lakechain/keybert-text-processor
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

This middleware is based on the [KeyBERT](https://github.com/MaartenGr/KeyBERT) keyword extraction and topic modeling library. It leverages the power of embedding models to identify the most significant keywords and topics in a text document, and to enrich the document metadata with them.

---

### 🏷️ Keyword Extraction

To use this middleware, you import it in your CDK stack and connect it to a data source that provides text documents, such as the [S3 Trigger](/project-lakechain/triggers/s3-event-trigger) if your text documents are stored in S3.

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

- [Topic Modeling Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/data-extraction-pipelines/topic-modeling-pipeline/) - An example showcasing how to extract relevant topics from text documents.
