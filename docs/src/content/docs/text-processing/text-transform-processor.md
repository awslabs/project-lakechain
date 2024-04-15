---
title: Text Transform
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.7.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/text-transform-processor">
    @project-lakechain/text-transform-processor
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The Text transform processor operates on plain text documents and allows to perform operations on text such as string replacements, base64 encoding, and substring extraction.

This middleware supports *semantic operations*, meaning that it understands the metadata associated with documents to use them as context to perform operations on them. For example, it can leverage PII, Part-of-Speech or Named Entities from document metadata to apply transformations such as substring redaction.

---

### 📝 Transforming Text

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline.

> 💁 In the below example, we redact Personal Identifiable Information (PII) from input documents. Note that  PII information need to be made available before being processed by the text transform processor.

```typescript
import { NlpTextProcessor, dsl as l } from '@project-lakechain/nlp-text-processor';
import { TextTransformProcessor, dsl as t } from '@project-lakechain/text-transform-processor';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    const cache = new CacheStorage(this, 'Cache');
    
    // Detect the PII in the text.
    const nlpProcessor = new NlpTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('Nlp')
      .withCacheStorage(cache)
      .withSource(source) // 👈 Specify a data source
      .withIntent(
        l.nlp()
          .language()
          .pii(l.confidence(0.9))
      )
      .build();

    // Redact PII from the text.
    const transform = new TextTransformProcessor.Builder()
      .withScope(this)
      .withIdentifier('TextTransform')
      .withCacheStorage(cache)
      .withSource(nlpProcessor)
      .withTransform(
        t.text().redact(t.pii())
      )
      .build();
  }
}
```

<br>

---

#### Chaining transformations

You can chain operations to be applied on input text. In the below example, we first select a substring part of the text document, replace several words in it, and then encode it in base64.

```typescript
import { TextTransformProcessor, dsl as t } from '@project-lakechain/text-transform-processor';

const transform = new TextTransformProcessor.Builder()
  .withScope(this)
  .withIdentifier('TextTransform')
  .withCacheStorage(cache)
  .withSource(source)
  .withTransform(
    t.text()
      .substring(0, 1024)
      .replace('hello', 'world')
      .base64()
  )
  .build();
```

<br>

---

### 🏗️ Architecture

This middleware is based on a Lambda compute running the logic associated with the text transform processor.

![Text Transform Architecture](../../../assets/text-transform-processor-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | Plain text documents. |

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

- [PII Redaction Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/pii-redaction-pipeline/) - A PII redaction pipeline using Project Lakechain.
