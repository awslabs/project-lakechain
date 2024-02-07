---
title: PDF
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.1.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/pdf-text-converter
</span>
<br>

---

The PDF text converter makes it possible to turn PDF documents into plain text documents. This can be helpful when extracting the text substance of PDF documents to analyze them, create vector embeddings, or use them as input to other NLP models.

> 💁 At this time, only text is extracted from PDF documents and other attributes such as images are not extracted.

---

### 🖨️ Converting PDFs

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline.

> 💁 The below example takes PDF documents uploaded into a source S3 bucket, and converts them to plain text.

```typescript
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    const cache = new CacheStorage(this, 'Cache');
    
    // Create the S3 event trigger.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(bucket)
      .build();
    
    // Convert uploaded PDF documents to plain text.
    trigger.pipe(new PdfTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PdfTextConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build());
  }
}
```

<br>

---

### 📝 Parsing Method

Converting the content of PDF documents into plain text is a difficult exercise as the PDF format has been initially designed to be a display format optimized for printing. Therefore, PDFs typically contain vector graphics and text is not stored in a linear fashion.

To optimize the results, the PDF text converter implements a 3-step parsing method that we document below.

![PDF Parsing Method](../../../assets/pdf-parsing.png)

The first step is to extract the raw text out of the document using the [`pdfminer.six`](https://pdfminersix.readthedocs.io/en/latest/) library. We then clean the text to remove invalid lines, and run the entire document through Pandoc to leverage its document formatting capabilities.

<br>

---

### 🏗️ Architecture

This middleware is based on a Lambda compute running the `pdfminer.six` library and Pandoc packaged as a Lambda Docker container.

![PDF Text Converter Architecture](../../../assets/pdf-text-converter-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `application/pdf` | PDF documents. |

##### Supported Outputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | Plain text documents. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Building a RAG Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-rag-pipeline/) - End-to-end RAG pipeline using Amazon Bedrock and Amazon OpenSearch.
