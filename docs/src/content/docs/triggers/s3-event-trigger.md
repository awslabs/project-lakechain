---
title: S3 Trigger
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.1.4
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/s3-event-trigger
</span>
<br>

---

The S3 trigger starts processing pipelines based on S3 object events. Specifically, it monitors the creation, modification and deletion of objects in monitored bucket(s).

---

### 🪣 Monitoring Buckets

To use this middleware, you import it in your CDK stack and specify the bucket(s) you want to monitor.

> ℹ️ The below example monitors a single bucket.

```typescript
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample bucket.
    const bucket = new s3.Bucket(this, 'Bucket', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');

    // Create the S3 event trigger.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(bucket)
      .build();
  }
}
```

You can also specify multiple buckets to be monitored by the S3 trigger.

```typescript
const trigger = new S3EventTrigger.Builder()
  .withScope(this)
  .withIdentifier('Trigger')
  .withCacheStorage(cache)
  .withBuckets([bucket1, bucket2])
  .build();
```

<br>

---

#### Filtering

It is also possible to provide finer grained filtering instructions to the `withBucket` method to monitor specific *prefixes* and/or *suffixes*.

```typescript
const trigger = new S3EventTrigger.Builder()
  .withScope(this)
  .withIdentifier('Trigger')
  .withCacheStorage(cache)
  .withBucket({
    bucket,
    prefix: 'data/',
    suffix: '.csv',
  })
  .build();
```

<br>

---

### 🏗️ Architecture

The S3 trigger receives S3 events from subscribed buckets on its SQS input queue. They are consumed by a Lambda function used to translate S3 events into a [CloudEvent](/project-lakechain/general/events). The Lambda function also takes care of identifying the mime-type of a document based on its extension, the S3 reported mime-type, or the content of the document itself.

![Architecture](../../../assets/s3-event-trigger-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

*This middleware does not accept any inputs from other middlewares.*

##### Supported Outputs

| Mime Type | Description |
| --------- | ----------- |
| `*/*`     | The S3 event trigger middleware can produce any type of document. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware is based on a Lambda architecture. |

<br>

---

### 📖 Examples

- [Face Detection Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/face-detection-pipeline) - An example showcasing how to build face detection pipelines using Project Lakechain.
