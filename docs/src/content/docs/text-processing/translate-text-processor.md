---
title: Translate
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.4.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/translate-text-processor">
    @project-lakechain/translate-text-processor
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The Translate text processor makes it possible to asynchronously translate documents from one language to a set of output languages using the [Amazon Translate](https://aws.amazon.com/translate/) service at scale.

This middleware leverages the [batch translation capabilities](https://docs.aws.amazon.com/translate/latest/dg/async.html) of Amazon Translate to translate documents. Batch translations are slower than synchronous translations, but support larger documents and formats. This middleware can translate `.txt`, `.html`, `.docx`, `.pptx`, `.xlsx`, and `.xliff` documents.

---

### 💬 Translating Documents

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline.

> 💁 The below example takes supported input document uploaded into a source S3 bucket, and translates them to French and Spanish.

```typescript
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { TranslateTextProcessor } from '@project-lakechain/translate-text-processor';
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
    
    // Translate uploaded text documents.
    trigger.pipe(new TranslateTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('TranslateTextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withOutputLanguages(['fr', 'es'])
      .build());
  }
}
```

<br>

---

#### Profanity Detection

Amazon Translate supports [masking profane words and sentences](https://docs.aws.amazon.com/translate/latest/dg/customizing-translations-profanity.html) from translation results. To enable profanity detection, you can use the `.withProfanityRedaction` method.

```typescript
const translate = new TranslateTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('TranslateTextProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withOutputLanguages(['fr', 'es'])
  .withProfanityRedaction(true) // 👈 Enable profanity detection
  .build();
```

<br>

---

#### Tone Formality

You can also adapt the tone formality of the translation results using the `.withFormality` method across `FORMAL` and `INFORMAL` tones.

```typescript
const translate = new TranslateTextProcessor.Builder()
  .withScope(this)
  .withIdentifier('TranslateTextProcessor')
  .withCacheStorage(cache)
  .withSource(source)
  .withOutputLanguages(['fr', 'es'])
  .withFormalityTone('FORMAL') // 👈 Set the tone formality
  .build();
```

<br>

---

### 🏗️ Architecture

This middleware implements an event-driven architecture leveraging Amazon Translate batch jobs, and runs several Lambda computes based on the ARM64 architecture to orchestrate the translation jobs.

This means that this middleware does not spend time waiting for the translations to be completed, but instead asynchronously keeps tracks of each translation jobs and forwards them to the next middlewares in the pipeline once they are completed.

![Architecture](../../../assets/translate-text-processor-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | Plain text documents. |
| `text/html` | HTML documents. |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Word documents. |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | PowerPoint documents. |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Excel documents. |
| `application/x-xliff+xml` | XLIFF documents. |

##### Supported Outputs

*This middleware supports the same output types as its input types.*

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Text Translation Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/text-translation-pipeline/) - An example showcasing how to translate documents using Amazon Translate.
