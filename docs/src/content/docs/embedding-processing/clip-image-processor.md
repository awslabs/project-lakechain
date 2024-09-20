---
title: CLIP
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.10.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/clip-image-processor">
    @project-lakechain/clip-image-processor
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The CLIP embedding processor leverages [OpenAI CLIP](https://github.com/openai/CLIP) models to create vector embeddings for image documents. It deploys the required infrastructure to create embeddings on an AWS account such that all the processing remains on customers AWS environment.

---

### 📷 Embedding Images

To use this middleware, you import it in your CDK stack and specify a VPC in which the image processing cluster will be deployed.

> ℹ️ The below example shows how to deploy the CLIP processor in a VPC.

```typescript
import { ClipImageProcessor } from '@project-lakechain/clip-image-processor';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'Vpc', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');

    // Create the CLIP processor.
    const clipProcessor = new ClipImageProcessor.Builder()
      .withScope(this)
      .withIdentifier('ImageProcessor')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(source) // 👈 Specify a data source
      .build();
  }
}
```

<br>

---

#### Specifying a Model

The `ClipImageProcessor` API makes it possible to specify a select CLIP model to use for creating embeddings.

> ℹ️ The default model is `ViT-B/32`, and this middleware supports the `ViT-B/32`, `ViT-B/16`, and `ViT-L/14` models.

```typescript
import { ClipImageProcessor, ClipModel } from '@project-lakechain/clip-image-processor';

const clipProcessor = new ClipImageProcessor.Builder()
  .withScope(this)
  .withIdentifier('ImageProcessor')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withSource(source)
  .withModel(ClipModel.VIT_L_14) // 👈 Specify a model
  .build();
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

The CLIP image processor middleware does not modify or alter source documents in any way. It instead enriches the metadata of the image documents with a pointer to the vector embedding that were created for the document.

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
          "url": "s3://bucket/image.png",
          "type": "image/png",
          "size": 245328,
          "etag": "1243cbd6cf145453c8b5519a2ada4779"
      },
      "document": {
          "url": "s3://bucket/image.png",
          "type": "image/png",
          "size": 245328,
          "etag": "1243cbd6cf145453c8b5519a2ada4779"
      },
      "metadata": {
        "properties": {
            "kind": "text",
            "attrs": {
              "embeddings": {
                "vectors": "s3://cache-storage/clip-image-processor/45a42b35c3225085.json",
                "model": "ViT-B/32",
                "dimensions": 512
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

The CLIP image processor requires GPU-enabled instances ([g4dn.xlarge](https://aws.amazon.com/ec2/instance-types/g4)) to run the embedding models. To orchestrate deployments, it deploys an ECS auto-scaled cluster of containers that consume documents from the middleware input queue. The cluster is deployed in the private subnet of the given VPC, and caches the models on an EFS storage to optimize cold-starts.

> ℹ️ The average cold-start for the CLIP containers is around 3 minutes when no instances are running.

![Architecture](../../../assets/clip-image-processor-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `image/bmp` | Bitmap image. |
| `image/gif` | GIF image. |
| `image/jpeg` | JPEG image. |
| `image/png` | PNG image. |
| `image/tiff` | TIFF image. |
| `image/webp` | WebP image. |
| `image/x-pcx` | PCX image. |

##### Supported Outputs

*This middleware supports as outputs the same types as the supported inputs.*

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `GPU` | This middleware only supports GPU compute. |

<br>

---

### 📖 Examples

- [Clip Embedding Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/embedding-pipelines/clip-embeddings-pipeline) - An example showcasing how to create embeddings for images using CLIP.
