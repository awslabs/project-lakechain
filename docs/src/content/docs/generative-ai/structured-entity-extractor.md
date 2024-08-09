---
title: Extractor
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.7.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/structured-entity-extractor">
    @project-lakechain/structured-entity-extractor
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The `StructuredEntityExtractor` middleware can be used to accurately extract structured entities as a JSON document from text using large-language models. The middleware uses models hosted on [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html) to extract structured entities from text documents.

With this middleware, you can specify a [Zod](https://zod.dev/) typed schema with your constraints and the middleware will convert the schema into a JSON schema specification with [Bedrock Tools](https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html) to perform a structured and typed extraction. It also validates the generated data against that schema, and automatically prompts the underlying model with any error generated to improve the quality of the extraction.

---

### 📖 Data Extraction

To start using this middleware in your pipelines, you import the `StructuredEntityExtractor` construct in your CDK stack, and specify the schema you want to use for the extraction.

> 💁 The below example demonstrates how to use this middleware to extract data from text documents provided by upstream middlewares.

```typescript
import { z } from 'zod';
import { StructuredEntityExtractor } from '@project-lakechain/structured-entity-extractor';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    const cache = new CacheStorage(this, 'Cache');

    // The schema to use for the extraction.
    const schema = z.object({
      title: z
        .string()
        .describe('The title of the document'),
      summary: z
        .string()
        .describe('A summary of the document')
    });

    // Extract structured data using the given schema.
    const extractor = new StructuredEntityExtractor.Builder()
      .withScope(this)
      .withIdentifier('StructuredEntityExtractor')
      .withCacheStorage(cache)
      .withSource(source)
      .withSchema(schema) // 👈 Specify the schema
      .build();
  }
}
```

<br />

---

### 🤖 Model Selection

You can select the specific Bedrock models to use with this middleware using the `.withModel` API.

> ℹ️ By default, the extractor uses the `anthropic.claude-3-sonnet-20240229-v1:0` model from Amazon Bedrock.

```typescript
import { StructuredEntityExtractor } from '@project-lakechain/structured-entity-extractor';

const extractor = new StructuredEntityExtractor.Builder()
  .withScope(this)
  .withIdentifier('StructuredEntityExtractor')
  .withCacheStorage(cache)
  .withSource(source)
  .withSchema(schema)
  .withModel('anthropic.claude-3-5-sonnet-20240620-v1:0') // 👈 Custom model
  .build();
```

> 💁 You can choose amongst the following models for structured entity extraction.

Model Name | Model identifier
---------- | ----------------
Claude 3 Haiku | `anthropic.claude-3-haiku-20240307-v1:0`
Claude 3 Sonnet | `anthropic.claude-3-sonnet-20240229-v1:0`
Claude 3.5 Sonnet | `anthropic.claude-3-5-sonnet-20240620-v1:0`
Claude 3 Opus | `anthropic.claude-3-opus-20240229-v1:0`
Cohere Command R | `cohere.command-r-v1:0`
Cohere Command R+ | `cohere.command-r-plus-v1:0`
Llama 3.1 8B | `meta.llama3-1-8b-instruct-v1:0`
Llama 3.1 70B | `meta.llama3-1-70b-instruct-v1:0`
Llama 3.1 405B | `meta.llama3-1-405b-instruct-v1:0`
Mistral Large | `mistral.mistral-large-2402-v1:0`
Mistral Large v2 | `mistral.mistral-large-2407-v1:0`
Mistral Small | `mistral.mistral-small-2402-v1:0`

<br />

---

### 📝 Instructions

In some cases, it can be very handy to provide domain specific instructions to the model for a better, more accurate, extraction. You can provide these instructions using the `.withInstructions` API.

> 💁 For example, if you're looking to translate a text, and want to ensure that you obtain only the translation with no preamble or other explanation, you can prompt the model with specific instructions as shown below.

```typescript
import { StructuredEntityExtractor } from '@project-lakechain/structured-entity-extractor';

const extractor = new StructuredEntityExtractor.Builder()
  .withScope(this)
  .withIdentifier('StructuredEntityExtractor')
  .withCacheStorage(cache)
  .withSource(source)
  .withSchema(schema)
  .withInstructions(`
    You must accurately translate the given text to 'french', while
    ensuring that you translate exactly the entire text,
    sentence by sentence.
  `)
  .build();
```

<br />

---

### 📄 Output

The structured data extracted from documents by this middleware are by default returned as a new JSON document that can be consumed by the next middlewares in a pipeline. Alternatively, you can also choose to embed the extracted data inside the document metadata, and leave the original document unchanged.

> 💁 You can control this behavior using the `.withOutputType` API.

```typescript
import { StructuredEntityExtractor } from '@project-lakechain/structured-entity-extractor';

const extractor = new StructuredEntityExtractor.Builder()
  .withScope(this)
  .withIdentifier('StructuredEntityExtractor')
  .withCacheStorage(cache)
  .withSource(source)
  .withSchema(schema)
  .withOutputType('metadata') // 👈 Change the output type
  .build();
```

When setting `metadata` as the output type, the original document is used as the output of this middleware without any changes. Below is an example of how the extracted data can be accessed from the document metadata.

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
            "url": "s3://bucket/text.txt",
            "type": "text/plain",
            "size": 2452,
            "etag": "1243cbd6cf145453c8b5519a2ada4779"
        },
        "document": {
            "url": "s3://bucket/text.txt",
            "type": "text/plain",
            "size": 2452,
            "etag": "1243cbd6cf145453c8b5519a2ada4779"
        },
        "metadata": {
          "custom": {
            "structured": {
              "title": "The title of the document",
              "summary": "A summary of the document"
            }
          }
        },
        "callStack": []
    }
  }
  ```

</details>

<br />

---

### 🌐 Region Selection

You can specify the AWS region in which you want to invoke the Amazon Bedrock model using the `.withRegion` API. This can be helpful if Amazon Bedrock is not yet available in your deployment region.

> 💁 By default, the middleware will use the current region in which it is deployed.

```typescript
import { StructuredEntityExtractor } from '@project-lakechain/structured-entity-extractor';

const extractor = new StructuredEntityExtractor.Builder()
  .withScope(this)
  .withIdentifier('StructuredEntityExtractor')
  .withCacheStorage(cache)
  .withRegion('us-east-1') // 👈 Custom region
  .withSource(source)
  .withSchema(schema)
  .build();
```

<br />

---

### 🧩 Composite Events

In addition to handling single documents, the Anthropic text processor also supports [composite events](/project-lakechain/general/events#-composite-events) as an input. This means that it can take multiple documents and compile them into a single input to the model.

This can come in handy in map-reduce pipelines where you use the [Reducer](/project-lakechain/flow-control/reducer) to combine multiple documents into a single input having a similar semantic, for example, multiple pages of a PDF document that you would like the model to extract data from, while keeping the context between the pages.

<br />

---

### 🏗️ Architecture

This middleware is based on a Lambda compute running on an ARM64 architecture, and integrate with Amazon Bedrock to extract data based on the given documents.

![Architecture](../../../assets/bedrock-text-generators-architecture.png)

<br />

---

### 🏷️ Properties

<br />

##### Supported Inputs

|  Mime Type                   | Description
| ---------------------------- | -----------
| `text/plain`                 | UTF-8 text documents.
| `text/markdown`              | Markdown documents.
| `text/csv`                   | CSV documents.
| `text/html`                  | HTML documents.
| `application/x-subrip`       | SubRip subtitles.
| `text/vtt`                   | Web Video Text Tracks (WebVTT) subtitles.
| `application/json`           | JSON documents.
| `application/xml`            | XML documents.
| `application/cloudevents+json` | Composite events emitted by the `Reducer`.

##### Supported Outputs

The supported output depends on the output type specified using the `.withOutputType` API. By default, this middleware will always return a JSON document with the `application/json` type.

If the output type is set to `metadata`, the original document is used as the output of this middleware.

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br />

---

### 📖 Examples

- [Structured Data Extraction Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/data-extraction-pipelines/structured-data-extraction-pipeline) - Builds a pipeline for structured data extraction from documents using Amazon Bedrock.
- [Bedrock Translation Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/text-translation-pipelines/bedrock-translation-pipeline) - An example showcasing how to translate documents using LLMs on Amazon Bedrock.
