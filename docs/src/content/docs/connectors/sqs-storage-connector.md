---
title: SQS Connector
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.1.4
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/sqs-storage-connector
</span>
<br>

---

The SQS storage connector makes it possible to capture the result of one or multiple middlewares in a pipeline and store their results in a user-defined SQS queue. This connector allows to nicely decouple the processing of your documents with third-party applications that can consume processed documents from a queue.

> 💁 This connector only forwards the [CloudEvents](/general/events) emitted by middlewares to the SQS queue, and not the documents themselves.

---

### 🕒 Enqueue Documents

To use the SQS storage connector, you import it in your CDK stack, and connect it to a data source providing documents.

```typescript
import { SQSStorageConnector } from '@project-lakechain/sqs-storage-connector';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');

    // The destination queue.
    const queue = // ...

    // Create the SQS storage connector.
    const connector = new SQSStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('SQSStorageConnector')
      .withCacheStorage(cache)
      .withSource(source) // 👈 Specify a data source
      .withDestinationQueue(queue)
      .build();
  }
}
```

<br>

---

### 🏗️ Architecture

This middleware makes use of the native integration between the SNS output topics of source middlewares with SQS to forward messages to a destination queue, without relying on any additional compute resources.

![SQS Storage Connector Architecture](../../../assets/sqs-storage-connector-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `*/*` | This middleware supports any type of documents. |

##### Supported Outputs

*This middleware does not emit any output.*

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Storage Connector Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/storage-connector-pipeline) - Builds a pipeline connected to other AWS services.
