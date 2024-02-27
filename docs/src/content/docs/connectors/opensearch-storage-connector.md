---
title: OpenSearch
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.4.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/opensearch-storage-connector">
    @project-lakechain/opensearch-storage-connector
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The OpenSearch storage connector enables developers to automatically push [CloudEvents](/project-lakechain/general/events) to an [OpenSearch](https://opensearch.org/) domain, and index documents at scale within their pipelines. This connector uses [AWS Firehose](https://aws.amazon.com/firehose/) to buffer events and store them in batch to OpenSearch using a serverless architecture.

---

### 🗄️ Indexing Documents

To use the OpenSearch storage connector, you import it in your CDK stack, and connect it to a data source providing document embeddings.

```typescript
import { OpenSearchStorageConnector } from '@project-lakechain/opensearch-storage-connector';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');

    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'Vpc');

    // The OpenSearch domain.
    const domain = // ...

    // Create the OpenSearch storage connector.
    const connector = new OpenSearchStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('OpenSearchStorage')
      .withCacheStorage(cache)
      .withSource(source)
      .withDomain(domain)
      .withVpc(vpc)
      .withIndexName('document-index')
      .build();
  }
}
```

<br>

---

#### Buffering Hints

This connector creates an AWS Firehose delivery stream to buffer events before sending them to OpenSearch. You can customize the way that the connector will buffer events by specifying optional buffering hints.

> ℹ️ The buffering hints are set to `10MB` or `60s` by default.

```typescript
const connector = new OpenSearchStorageConnector.Builder()
  .withScope(this)
  .withIdentifier('OpenSearchStorage')
  .withCacheStorage(cache)
  .withSource(source)
  .withDomain(domain)
  .withVpc(vpc)
  .withIndexName('document-index')
  .withBufferingHints({
    intervalInSeconds: 60,
    sizeInMBs: 50
  })
  .build();
```

<br>

---

#### Index Rotation

You can also configure the rotation period of the OpenSearch index that is applied by AWS Firehose.

> ℹ️ The index rotation is set to `NoRotation` by default.

```typescript
import {
  OpenSearchStorageConnector,
  IndexRotationPeriod
} from '@project-lakechain/opensearch-storage-connector';

const connector = new OpenSearchStorageConnector.Builder()
  .withScope(this)
  .withIdentifier('OpenSearchStorage')
  .withCacheStorage(cache)
  .withSource(source)
  .withDomain(domain)
  .withVpc(vpc)
  .withIndexName('document-index')
  .withIndexRotationPeriod(IndexRotationPeriod.OneDay)
  .build();
```

Possible values for the index rotation period are `NoRotation`, `OneHour`, `OneDay`, `OneWeek`, and `OneMonth`.

<br>

---

### ℹ️ Limits

This middleware forwards each discrete document events to OpenSearch using the [Default Document Id Format](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kinesisfirehose.CfnDeliveryStream.DocumentIdOptionsProperty.html#defaultdocumentidformat), which means that Firehose will generate a new unique document ID for each record based on a unique internal identifier.

This identifier remains stable across delivery attempts. However if you resubmit the same document in the pipeline (having the same URI), Firehose will generate a new unique document identifier, resulting in the duplication of the document in the OpenSearch index.

Another limitation of this middleware is that it currently only supports OpenSearch domains, and not OpenSearch Serverless collections.

<br>

---

### 🏗️ Architecture

This middleware uses AWS Firehose to buffer incoming document events from other middlewares in a pipeline, and uses the AWS Firehose native integration with OpenSearch to index documents.

![OpenSearch Storage Connector Architecture](../../../assets/opensearch-storage-connector-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `*/*` | This middleware supports any type of documents. |

##### Supported Outputs

*This middleware does not produce any output.*

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Building a Document Index](https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-document-index) - End-to-end document metadata extraction with OpenSearch.
