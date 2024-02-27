---
title: Bark
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.4.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/bark-synthesizer">
    @project-lakechain/bark-synthesizer
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The Bark synthesizer middleware synthesizes input text documents into voices using the [Bark generative audio model](https://github.com/suno-ai/bark/tree/main). The synthesizer deploys a cluster of GPU-enabled containers in a VPC to automate the synthesis process, and keep all data within the boundaries of the AWS account.

---

### 🐶 Synthesizing Text

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline and connect it to a data source that provides input documents, such as the [S3 Trigger](/project-lakechain/triggers/s3-event-trigger).

```typescript
import { BarkSynthesizer } from '@project-lakechain/bark-synthesizer';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'Vpc', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');
    
    // Convert the text to speech using the Bark model.
    const synthesizer = new BarkSynthesizer.Builder()
      .withScope(this)
      .withIdentifier('BarkTextToSpeech')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(source) // 👈 Specify a data source
      .build();
  }
}
```

<br>

---

#### Input Language

The Bark synthesizer needs to know what is the source language of the text to be able to select the appropriate voice for the text-to-speech synthesis. The first location used by the middleware to infer the source language is the document metadata. If a previous middleware, such as the [NLP Text Processor](/project-lakechain/text-processing/nlp-text-processor), has already detected the language of the document, the synthesizer will use that information. If no language was specified, the Bark synthesizer will assume the input document language to be english.

> ℹ️ Below is an example showcasing how to use the NLP Text processor to detect the language of input text documents to enrich their metadata before the Bark synthesizer is invoked.

```typescript
import { NlpTextProcessor, dsl as l } from '@project-lakechain/nlp-text-processor';
import { BarkSynthesizer } from '@project-lakechain/bark-synthesizer';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'Vpc', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');
    
    // Detects the language of input text documents.
    const nlp = new NlpTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('Nlp')
      .withCacheStorage(cache)
      .withSource(source)
      .withIntent(
        l.nlp().language()
      )
      .build();

    // Convert the text to speech using the Bark model.
    const synthesizer = new BarkSynthesizer.Builder()
      .withScope(this)
      .withIdentifier('BarkTextToSpeech')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(nlp)
      .build();
  }
}
```

<br>

---

#### Language Override

It is also possible to override the input language of text documents. In this case, developers can force the Bark synthesizer to assume a specific input language.

```typescript
const synthesizer = new BarkSynthesizer.Builder()
  .withScope(this)
  .withIdentifier('BarkTextToSpeech')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withSource(source)
  .withLanguageOverride('fr')
  .build();
```

<br>

---

#### Voice Mapping

By default, the Bark synthesizer will randomly select a suitable voice from the input language associated with a document. You can however specify a list of specific voices that you would like to associate with each language to better control which voice gets used during the synthesis process.

> ℹ️ Check the [Bark documentation](https://suno-ai.notion.site/8b8e8749ed514b0cbf3f699013548683?v=bc67cff786b04b50b3ceb756fd05f68c) to learn more about available voices.

```typescript
const synthesizer = new BarkSynthesizer.Builder()
  .withScope(this)
  .withIdentifier('BarkTextToSpeech')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withSource(source)
  .withVoiceMapping('en', 'v2/en_speaker_0', 'v2/en_speaker_1')
  .withVoiceMapping('fr', 'v2/fr_speaker_0')
  .build();
```

<br>

---

#### Temperature

Since the Bark Synthesizer uses a generative model, it is possible to control the amount of randomness in the generated audio by specifying a temperature value. The temperature value is a floating point number between 0 and 1. The higher the temperature, the more random the generated audio will be.

```typescript
const synthesizer = new BarkSynthesizer.Builder()
  .withScope(this)
  .withIdentifier('BarkTextToSpeech')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withSource(source)
  .withTemperature(0.5) // 👈 Specify a temperature value
  .build();
```

<br>

---

#### Auto-Scaling

The cluster of containers deployed by this middleware will auto-scale based on the number of documents that need to be processed. The cluster scales up to a maximum of 5 instances by default, and scales down to zero when there are no images to process.

> ℹ️ You can configure the maximum amount of instances that the cluster can auto-scale to by using the `withMaxInstances` method.

```typescript
const synthesizer = new BarkSynthesizer.Builder()
  .withScope(this)
  .withIdentifier('BarkTextToSpeech')
  .withCacheStorage(cache)
  .withVpc(vpc)
  .withSource(source)
  .withMaxInstances(10) // 👈 Maximum amount of instances
  .build();
```

<br>

---

### 🏗️ Architecture

The Bark synthesizer requires GPU-enabled instances ([g5.xlarge](https://aws.amazon.com/fr/ec2/instance-types/g5/)) to run the Bark audio model. To orchestrate deployments, it deploys an ECS auto-scaled cluster of containers that consume documents from the middleware input queue. The cluster is deployed in the private subnet of the given VPC, and caches the model on an EFS storage to optimize cold-starts.

> ℹ️ The average cold-start for the Bark synthesizer is around 3 minutes when no instances are running.

![Bark Synthesizer Architecture](../../../assets/bark-synthesizer-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `text/plain` | UTF-8 text documents. |

##### Supported Outputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `audio/mpeg` | MP3 audio documents. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `GPU` | This middleware only supports GPU compute. |

<br>

---

### 📖 Examples

- [Bark Synthesizer Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/text-to-speech-pipelines/bark-synthesizer) - Builds a pipeline for synthesizing text to speech using the Bark model.
