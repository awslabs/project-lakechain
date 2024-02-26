---
title: Polly
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.4.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  @project-lakechain/polly-synthesizer
</span>
<br>

---

The Polly Synthesizer allows to synthesize speech from text using the [Amazon Polly](https://aws.amazon.com/polly/) service. Using this middleware, you can synthesize at scale speech from your plain text documents using a matrix of multiple languages and voices.

---

### 📝 Synthesizing Text

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline.

> 💁 In the below example, we use the [NLP Processor](/project-lakechain/text-processing/nlp-text-processor) to detect the language of the text and then use the Polly synthesizer to convert the text to speech using the detected language.

```typescript
import { PollySynthesizer } from '@project-lakechain/polly-synthesizer';
import { NlpTextProcessor, dsl as l } from '@project-lakechain/nlp-text-processor';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');
    
    // Detect the language of the text using the NLP
    // processor.
    const nlpProcessor = new NlpTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('Nlp')
      .withCacheStorage(cache)
      .withSource(source) // 👈 Specify a data source
      .withIntent(
        l.nlp().language()
      )
      .build();

    // Convert the text to speech using Amazon Polly.
    const synthesizer = new PollySynthesizer.Builder()
      .withScope(this)
      .withIdentifier('PollySynthesizer')
      .withCacheStorage(cache)
      .withSource(nlpProcessor)
      .build();
  }
}
```

<br>

---

#### Language Override

Amazon Polly needs to know the source language of the text to be able to associate with with a voice that is fit for synthesizing the text. In the previous example, we've used the [NLP Processor](/project-lakechain/text-processing/nlp-text-processor) to detect the language of the text and then use the Polly synthesizer to convert the text to speech using the detected language.

You can however manually override the source language of the text if your source documents share a common known language that is [supported by Amazon Polly](https://docs.aws.amazon.com/polly/latest/dg/SupportedLanguage.html).

```typescript
import { PollySynthesizer } from '@project-lakechain/polly-synthesizer';

const synthesizer = new PollySynthesizer.Builder()
  .withScope(this)
  .withIdentifier('PollySynthesizer')
  .withCacheStorage(cache)
  .withSource(source)
  .withLanguageOverride('en') // 👈 Override the language
  .build();
```

<br>

---

#### Voice Mapping

By default, the Polly synthesizer will randomly select a compatible voice associated with the input language of a document. You can however explicitly specify a list of voices that you would like to associate with each language to better control which voice gets used during the synthesis process.

In Amazon Polly, you can choose between [neural voices](https://docs.aws.amazon.com/polly/latest/dg/ntts-voices-main.html) and standard voices. Neural voices can produce even higher quality voices than standard voices, and produce the most natural and human-like text-to-speech voices possible.

> 💁 Not all voices support the neural engine. You can find the list of supported voices for each language [here](https://docs.aws.amazon.com/polly/latest/dg/voicelist.html). The Polly synthesizer middleware validates the voice mappings you specify at deployment time to ensure they are correct.

```typescript
import { PollySynthesizer, dsl as v } from '@project-lakechain/polly-synthesizer';

const synthesizer = new PollySynthesizer.Builder()
  .withScope(this)
  .withIdentifier('PollySynthesizer')
  .withCacheStorage(cache)
  .withSource(source)
  // Specify specific voices for some languages.
  .withVoiceMapping('en', v.neural('Joanna'), v.neural('Matthew'))
  .withVoiceMapping('fr', v.standard('Celine'), v.neural('Lea'))
  .build();
```

<br>

---

### ℹ️ Limits

This middleware automatically applies a throttling mechanism when consuming messages from its input queue to stay within the minimal [Amazon Polly Throttling Rates](https://docs.aws.amazon.com/polly/latest/dg/limits.html) of 1 tps.

The applicable [limit](https://docs.aws.amazon.com/polly/latest/dg/limits.html) of 200,000 characters in Amazon Polly also applies to text documents processed by this middleware.

<br>

---

### 🏗️ Architecture

The Polly Synthesizer middleware builds on top of an event-driven architecture leveraging Amazon Polly [asynchronous jobs](https://docs.aws.amazon.com/polly/latest/dg/asynchronous.html) to synthesize long documents.

This architecture uses an *event handler* function which consumes input documents, schedules a synthesis task on Amazon Polly, and keeps track of input events in a DynamoDB table.

Once the synthesis task is completed, the *result handler* function is invoked when Amazon Polly publishes the results of the synthesis process on an SNS topic. It then retrieves the synthesized audio information, updates the CloudEvent with the new audio file, and publishes it to the next middlewares in the pipeline.

![Polly Synthesizer Architecture](../../../assets/polly-synthesizer-architecture.png)

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
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Polly Synthesizer Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/text-to-speech-pipelines/polly-synthesizer) - Builds a pipeline for synthesizing text to speech using Amazon Polly.
