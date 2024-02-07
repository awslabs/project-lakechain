---
title: Email
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.1.4
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/email-text-processor
</span>
<br>

---

The e-mail text processor makes it easy to extract the textual content of e-mail documents and pipe it to other middlewares for further processing. This middleware can extract text, HTML, and structured JSON from e-mail documents. It also optionally supports the extraction of attachments and forwarding them as new documents to other middlewares.

---

### 📨 Parsing E-mails

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline.

```typescript
import { EmailTextProcessor } from '@project-lakechain/email-text-processor';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');
    
    // Create the e-mail text processor.
    const emailProcessor = new EmailTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('EmailProcessor')
      .withCacheStorage(cache)
      .withSource(source) // 👈 Specify a data source
      .build();
  }
}
```

<br>

---

#### Output Formats

The e-mail text processor can extract the following formats from e-mail documents:

- `text`: Extracts only the textual body of the e-mail.
- `html`: Extracts the body of the e-mail as HTML.
- `json`: Extracts the body and the attributes of the e-mail as JSON.

> 💁 You can specify the output format by using the `withFormat` method. By default, the output format is `text`.

```typescript
const emailProcessor = new EmailTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('EmailProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withFormat('html') // 👈 Specify the output format
  .build();
```

<br>

---

#### Include Attachments

The e-mail text processor can optionally extract attachments from e-mail documents and forward them as new documents to other middlewares. You can enable the processing of attachments using the `.withIncludeAttachments` API.

```typescript
const emailProcessor = new EmailTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('EmailProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withIncludeAttachments(true) // 👈 Enable the processing of attachments
  .build();
```

<br>

---

#### Include Image Links

This middleware supports converting CID attachments to data URL images. You can enable this feature using the `.withIncludeImageLinks` API.

```typescript
const emailProcessor = new EmailTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('EmailProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withIncludeImageLinks(true) // 👈 Enable the processing of image links
  .build();
```

<br>

---

### 📄 Metadata

The e-mail text processor transforms input e-mail documents in the desired output format. It also enriches the metadata of documents with different information. Below is an example of the metadata created by this middleware.

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
          "url": "s3://bucket/email.eml",
          "type": "message/rfc822",
          "size": 24532,
          "etag": "1243cbd6cf145453c8b5519a2ada4779"
      },
      "document": {
          "url": "s3://bucket/email.txt",
          "type": "text/plain",
          "size": 125,
          "etag": "1243cbd6cf145453c8b5519a2ada4779"
      },
      "metadata": {
        "title": "Re: Hello World",
        "createdAt": "2023-10-22T13:19:10.657Z",
        "authors": [
          "John Doe"
        ],
        "properties": {
          "kind": "text",
          "attrs": {}
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

This middleware is based on a Lambda ARM64 compute, and packages the [`mailparser`](https://www.npmjs.com/package/mailparser) library to parse e-mail documents.

![Architecture](../../../assets/email-text-processor-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `message/rfc822` | E-mail documents. |
| `application/vnd.ms-outlook` | Outlook e-mail documents. |

##### Supported Outputs

The supported output types for this middleware consist of a variant that depends on whether or not the inclusion of attachments is enabled. If attachments are included, the output type is `*/*` as attachments can consist of any type, otherwise the output type is associated with the defined output format.

| Output Format | With Attachment | Mime Type | Description |
| ------------- | ------------------- | --------- | ----------- |
| `text` | No | `text/plain` | Plain text document. |
| `text` | Yes | `*/*` | Any document. |
| `html` | No | `text/html` | HTML document. |
| `html` | Yes | `*/*` | Any document. |
| `json` | No | `application/json` | JSON document. |
| `json` | Yes | `*/*` | Any document. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [E-mail NLP Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/email-nlp-pipeline/) - An example showcasing how to analyze e-mails.
