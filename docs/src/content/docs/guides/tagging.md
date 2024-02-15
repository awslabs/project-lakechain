---
title: Tags
---

Project Lakechain makes it possible to apply a specific [tagging strategy](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/building-your-tagging-strategy.html) to all the AWS resources created by middlewares across your pipelines.

> ℹ️ [Tagging](https://docs.aws.amazon.com/tag-editor/latest/userguide/tagging.html) is a best practice to help you manage your AWS resources. It is a metadata that consists of a key-value pair that you can assign to AWS resources. It allows you to categorize resources, and track costs and usage across your AWS environments.

<br>

---

### 🏷️ Default Tags

By default, the Lakechain framework applies a set of tags to all the supported AWS resources it creates, which are documented below.

<br>

| Tag       | Value               | Description |
| --------- | ------------------- | ----------- |
| Context | `project-lakechain` | Tags all resources created by Lakechain. |
| Service | Middleware name | Tags all resources created by a middleware. |
| Version | Semantic version | The version of the specific middleware. |

<br>

---

### 🔖 Customize Tags

You can also apply your own tags to the resources created by Lakechain. The following example demonstrates how to apply tags to a specific middleware instance.

```typescript
import * as cdk from 'aws-cdk-lib';

// Instantiate a middleware.
const trigger = new S3EventTrigger.Builder()
  .withScope(this)
  .withIdentifier('Trigger')
  .withCacheStorage(cache)
  .withBucket(source)
  .build();

// Apply custom tags.
cdk.Tags.of(trigger).add('Environment', 'Production');
cdk.Tags.of(trigger).add('Team', 'Cloud Engineering');
```

> 💁 You can also apply the same principle to an entire CDK stack if you don't need to apply tags with the granularity of a middleware.
