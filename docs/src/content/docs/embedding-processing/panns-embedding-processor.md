---
title: PANN
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.3.4
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/panns-embedding-processor
</span>
<br>

---

The [Large-Scale Pre-trained Audio Neural Networks](https://github.com/qiuqiangkong/panns_inference) provides the foundation for creating embeddings for audio documents leveraging specific features from audio such as [Mel-frequency cepstral coefficients (MFCCs)](https://en.wikipedia.org/wiki/Mel-frequency_cepstrum) and Chroma features. This allows customers to perform semantic similarity search on a set of audio documents using this middleware, in combination with a vector database.

---

### 🎧 Embedding Audio

To use this middleware, you import it in your CDK stack and specify a VPC in which the audio processing cluster will be deployed.

```typescript
import { PannsEmbeddingProcessor } from '@project-lakechain/panns-embedding-processor';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'Vpc', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');

    // Create the PANNs processor.
    const pannsProcessor = new PannsEmbeddingProcessor.Builder()
      .withScope(this)
      .withIdentifier('AudioProcessor')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(source) // 👈 Specify a data source
      .build();
  }
}
```

<br>

---

#### Auto-Scaling

The cluster of containers deployed by this middleware will auto-scale based on the number of images that need to be processed. The cluster scales up to a maximum of 5 instances by default, and scales down to zero when there are no images to process.

> ℹ️ You can configure the maximum amount of instances that the cluster can auto-scale to by using the `withMaxInstances` method.

```typescript
const clipProcessor = new ClipImageProcessor.Builder()
  .withScope(this)
  .withIdentifier('ImageProcessor')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withSource(source)
  .withMaxInstances(10)
  .build();
```

<br>

---

### 📄 Output

The PANNs embedding processor middleware does not modify or alter source documents in any way. It instead enriches the metadata of the audio documents with a pointer to the vector embedding that were created for the document.

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
          "url": "s3://bucket/audio.mp3",
          "type": "audio/mpeg",
          "size": 245328,
          "etag": "1243cbd6cf145453c8b5519a2ada4779"
      },
      "document": {
          "url": "s3://bucket/audio.mp3",
          "type": "audio/mpeg",
          "size": 245328,
          "etag": "1243cbd6cf145453c8b5519a2ada4779"
      },
      "metadata": {
        "properties": {
            "kind": "text",
            "attrs": {
              "embeddings": {
                "vectors": "s3://cache-storage/panns-embedding-processor/45a42b35c3225085.json",
                "model": "panns_inference",
                "dimensions": 2048
            }
          }
        }
      },
      "callStack": []
    }
  }
  ```

</details>

<br>

---

### 🏗️ Architecture

The PANNs embedding processor requires GPU-enabled instances ([g4dn.xlarge](https://aws.amazon.com/ec2/instance-types/g4)) to run the PANNs embedding model. To orchestrate deployments, it deploys an ECS auto-scaled cluster of containers that consume documents from the middleware input queue. The cluster is deployed in the private subnet of the given VPC, and caches the models on an EFS storage to optimize cold-starts.

> ℹ️ The average cold-start for the PANNs containers is around 3 minutes when no instances are running.

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `audio/mpeg` | MPEG audio documents. |
| `audio/mp3` | MP3 audio documents. |
| `audio/mp4` | MP4 audio documents. |
| `audio/wav` | WAV audio documents. |
| `audio/x-wav` | WAV audio documents. |
| `audio/x-m4a` | M4A audio documents. |
| `audio/ogg` | OGG audio documents. |
| `audio/x-flac` | FLAC audio documents. |
| `audio/flac` | FLAC audio documents. |
| `audio/x-aiff` | AIFF audio documents. |
| `audio/aiff` | AIFF audio documents. |
| `audio/x-ms-wma` | WMA audio documents. |
| `audio/x-matroska` | MKV audio documents. |
| `audio/webm` | WebM audio documents. |
| `audio/aac` | AAC audio documents. |

##### Supported Outputs

*This middleware supports as outputs the same types as the supported inputs.*

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `GPU` | This middleware only supports GPU compute. |

<br>

---

### 📖 Examples

- [PANNs OpenSearch Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/embedding-pipelines/panns-opensearch-pipeline) - An example showcasing an audio embedding pipeline using PANNS and OpenSearch.
