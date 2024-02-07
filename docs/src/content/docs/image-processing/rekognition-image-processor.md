---
title: Rekognition
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.1.4
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/rekognition-image-processor
</span>
<br>

---

The Rekognition image processor enables customers to leverage the power of [Amazon Rekognition](https://docs.aws.amazon.com/rekognition/latest/dg/what-is.html) and its computer vision capabilities within their document processing pipelines.

---

### 💡 Intents

To use this middleware, you define an *intent* that specifies the type of processing you want to operate on images. Intents expose a powerful functional API making it easy to describe the Amazon Rekognition capabilities you want to leverage when processing images.

> In the following sections, we will explore several use-cases that demonstrate how to use intents.

<br>

---

#### Detecting Faces

Let's start with a simple example where we use Amazon Rekognition's ability to identify faces in images. In the below example, we define an intent that will extract face information from images and store them within the document metadata.

> 💁 We're using the intent domain-specific language (DSL) to express actions within an intent.

```typescript
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');

    // Create the Rekognition image processor.
    const rekognitionProcessor = new RekognitionImageProcessor.Builder()
      .withScope(this)
      .withIdentifier('ImageProcessor')
      .withCacheStorage(cache)
      .withSource(source) // 👈 Specify a data source
      .withIntent(
        r.detect().faces()
      )
      .build();
  }
}
```

> ℹ️ Please note that before using Amazon Rekognition's face detection capabilities, you should read the Amazon Rekognition [Guidelines on Face Attributes](https://docs.aws.amazon.com/rekognition/latest/dg/guidance-face-attributes.html).

<br>

---

#### Detecting Labels

Another powerful feature of Amazon Rekognition is its ability to detect the labels and the objects associated with an image. You can format your intent to identify labels and objects as follows.

```typescript
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';

const rekognitionProcessor = new RekognitionImageProcessor.Builder()
  .withScope(this)
  .withIdentifier('ImageProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withIntent(
    r.detect().labels()
  )
  .build();
```

<br>

---

#### Detecting Text

Amazon Rekognition can also detect text within images. Format your intent as follows to enable text detection.

```typescript
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';

const rekognitionProcessor = new RekognitionImageProcessor.Builder()
  .withScope(this)
  .withIdentifier('ImageProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withIntent(
    r.detect().text()
  )
  .build();
```

<br>

---

#### PPE Detection

To detect personal protective equipment (PPE) within images, you can express your intent as follows.

```typescript
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';

const rekognitionProcessor = new RekognitionImageProcessor.Builder()
  .withScope(this)
  .withIdentifier('ImageProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withIntent(
    r.detect().ppe()
  )
  .build();
```

<br>

---

#### Combining Actions

All actions can be combined within a single intent, and the Rekognition image processor will execute them in the order in which they are defined.

```typescript
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';

const rekognitionProcessor = new RekognitionImageProcessor.Builder()
  .withScope(this)
  .withIdentifier('ImageProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withIntent(
    r.detect()
      .faces()
      .labels()
      .text()
      .ppe()
  )
  .build();
```

<br>

---

### 📑 Using Filters

Each action within the DSL supports one or more filters that you can apply to it. For example, the `faces` action part of the `detect` verb supports different filters.

> ℹ️ The below example uses the `MinConfidence` filter to detect faces with a confidence level of 90% or higher.

```typescript
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';

const rekognitionProcessor = new RekognitionImageProcessor.Builder()
  .withScope(this)
  .withIdentifier('ImageProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withIntent(
    r.detect()
      .faces(r.confidence(90))
  )
  .build();
```

<br>

---

#### Chaining Filters

You can also chain multiple filters together to express more complex intent actions.

> ℹ️ The below example detects faces having a confidence of at least 90%, having a `smile` attribute, and limits results to a maximum of 10 faces.

```typescript
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';

const rekognitionProcessor = new RekognitionImageProcessor.Builder()
  .withScope(this)
  .withIdentifier('ImageProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withIntent(
    r.detect()
      .faces(
        r.confidence(90),
        r.attributes(r.smile()),
        r.limit(10)
      )
  )
  .build();
```

<br>

---

### 🏗️ Architecture

The Rekognition image processor uses AWS Lambda as its compute, using an ARM64 architecture. The Lambda function is integrated with the Amazon Rekognition service, and issues the appropriate API calls to process images given the intent defined by the user.

![Architecture](../../../assets/rekognition-image-processor-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `image/jpeg` | JPEG images. |
| `image/png` | PNG images. |

##### Supported Outputs

*This middleware supports as outputs the same types as the supported inputs.*

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Face Detection Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/face-detection-pipeline) - An example showcasing how to build face detection pipelines using Project Lakechain.
- [Document Indexing Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-document-index) - End-to-end document metadata extraction with OpenSearch.
