---
title: Pandoc
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.5.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/pandoc-text-converter">
    @project-lakechain/pandoc-text-converter
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The Pandoc middleware converts at scale documents from a matrix of multiple formats using the [Pandoc](https://pandoc.org/) project. You can for example convert HTML, Docx, or Markdown documents into plain text to be able to run NLP analysis, or convert Markdown documents into PDF documents for creating nice-looking reports.

---

### 🔁 Converting Documents

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline.

> 💁 The below example takes supported input document types uploaded into a source S3 bucket, and converts them to plain text.

```typescript
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');
    
    // Create the S3 event trigger.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(bucket)
      .build();
    
    // Convert uploaded documents to plain text.
    trigger.pipe(new PandocTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PandocTextConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build());
  }
}
```

<br>

---

#### Conversion Matrix

By default, the Pandoc text converter will convert supported input documents to plain text. You can however explicitly specify a conversion matrix describing which inputs to converts into which outputs.

> 💁 The below example demonstrates how to convert Docx documents to both plain text and PDF, and Markdown documents to HTML.

```typescript
import { PandocTextConverter, from } from '@project-lakechain/pandoc-text-converter';

const pandoc = new PandocTextConverter.Builder()
  .withScope(this)
  .withIdentifier('PandocTextConverter')
  .withCacheStorage(cache)
  .withSource(trigger)
  .withConversions(
    from('docx').to('plain', 'pdf'),
    from('md').to('html')
  )
  .build();
```

<br>

---

### 🏗️ Architecture

This middleware is based on a Python Lambda compute running the Pandoc project using the [`pypandoc`](https://pypi.org/project/pypandoc/) library packaged as a Lambda layer.

![Pandoc Architecture](../../../assets/pandoc-text-converter-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `application/epub+zip` | EPUB documents. |
| `text/csv` | CSV documents. |
| `text/tab-separated-values` | TSV documents. |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Word documents. |
| `text/markdown` | Markdown documents. |
| `text/html` | HTML documents. |
| `application/vnd.oasis.opendocument.text` | OpenOffice documents. |
| `application/rtf` | RTF documents. |
| `application/x-tex` | LaTeX documents. |
| `text/x-rst` | RST documents. |
| `text/x-textile` | Textile documents. |
| `application/x-ipynb+json` | Jupyter Notebook documents. |
| `text/troff` | Manual documents. |
| `application/x-bibtex` | BibTex documents. |
| `application/docbook+xml` | Docbook documents. |
| `application/x-fictionbook+xml` | FictionBook documents. |
| `text/x-opml` | OPML documents. |
| `application/x-texinfo` | Texinfo documents. |

##### Supported Outputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/x-asciidoc` | Asciidoc documents. |
| `application/x-bibtex` | BibTex documents. |
| `application/docbook+xml` | Docbook documents. |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Word documents. |
| `application/epub+zip` | EPUB documents. |
| `application/x-fictionbook+xml` | FictionBook documents. |
| `text/x-haskell` | Haskell documents. |
| `text/html` | HTML documents. |
| `application/xml` | XML documents. |
| `application/x-ipynb+json` | Jupyter Notebook documents. |
| `application/json` | JSON documents. |
| `application/x-tex` | LaTeX documents. |
| `text/troff` | Manual documents. |
| `text/markdown` | Markdown documents. |
| `text/plain` | Plain text documents. |
| `application/vnd.oasis.opendocument.text` | OpenOffice documents. |
| `text/x-opml` | OPML documents. |
| `application/pdf` | PDF documents. |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | PowerPoint documents. |
| `text/x-rst` | RST documents. |
| `application/rtf` | RTF documents. |
| `application/x-texinfo` | Texinfo documents. |
| `text/x-textile` | Textile documents. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Building a RAG Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-rag-pipeline/) - End-to-end RAG pipeline using Amazon Bedrock and Amazon OpenSearch.
- [Pipeline Encryption](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/pipeline-encryption/) - An example showcasing how to encrypt end-to-end a pipeline using a CMK.
