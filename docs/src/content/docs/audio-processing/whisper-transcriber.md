---
title: Whisper
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.7.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/whisper-transcriber">
    @project-lakechain/whisper-transcriber
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The Whisper transcriber enables developers to deploy [Whisper models](https://github.com/openai/whisper) on AWS and use them as part of their processing pipelines to transcribe audio files into text. This middleware deploys a cluster of GPU-enabled containers in a VPC to automate the synthesis process, and keep all data within the boundaries of the AWS account.

---

### 📝 Transcribing Audio

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline.

```typescript
import { WhisperTranscriber } from '@project-lakechain/whisper-transcriber';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    // Sample VPC.
    const vpc = new ec2.Vpc(this, 'Vpc', {});

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache');
    
    // Transcribe audio documents to text.
    const whisper = new WhisperTranscriber.Builder()
      .withScope(this)
      .withIdentifier('WhisperTranscriber')
      .withCacheStorage(cache)
      .withSource(source) // 👈 Specify a data source
      .withVpc(vpc)
      .build();
  }
}
```

<br>

---

#### Specifying a Model

By default, the `small` model is used to transcribe audio files. You can however specify a different model by passing it to the `withModel` method.

```typescript
const whisper = new WhisperTranscriber.Builder()
  .withScope(this)
  .withIdentifier('WhisperTranscriber')
  .withCacheStorage(cache)
  .withSource(source)
  .withVpc(vpc)
  .withModel('medium')
  .build();
```

You can choose between the following models : `tiny`, `tiny.en`, `base`, `base.en`, `small`, `small.en`, `medium`, `medium.en`, `large`, `large-v1`, `large-v2`,  and `large-v3`.

<br>

---

#### Specifying an Output Format

The Whisper middleware supports transcribing audio documents into different output formats. By default, the `vtt` subtitle format is used. You can however specify a different output format by passing it to the `withOutputFormat` method.

```typescript
const whisper = new WhisperTranscriber.Builder()
  .withScope(this)
  .withIdentifier('WhisperTranscriber')
  .withCacheStorage(cache)
  .withSource(source)
  .withVpc(vpc)
  .withOutputFormat('srt')
  .build();
```

You can choose between the following output formats : `srt`, `vtt`, `tsv`, `txt`, and `json`.

<br>

---

#### Specifying an Engine

By default, this middleware uses the [OpenAI Whisper](https://github.com/openai/whisper) implementation to transcribe audio documents. It also supports the [Faster Whisper](https://github.com/SYSTRAN/faster-whisper) engine to perform transcriptions. You can specify the engine to use by passing it to the `withEngine` method.

```typescript
const whisper = new WhisperTranscriber.Builder()
  .withScope(this)
  .withIdentifier('WhisperTranscriber')
  .withCacheStorage(cache)
  .withSource(source)
  .withVpc(vpc)
  .withEngine('openai_whisper')
  .build();
```

You can choose between the following engines : `openai_whisper` and `faster_whisper`.

<br>

---

#### Auto-Scaling

The cluster of containers deployed by this middleware will auto-scale based on the number of documents that need to be processed. The cluster scales up to a maximum of 5 instances by default, and scales down to zero when there are no images to process.

> ℹ️ You can configure the maximum amount of instances that the cluster can auto-scale to by using the `withMaxInstances` method.

```typescript
const whisper = new WhisperTranscriber.Builder()
  .withScope(this)
  .withIdentifier('WhisperTranscriber')
  .withCacheStorage(cache)
  .withSource(source)
  .withVpc(vpc)
  .withMaxInstances(10)
  .build();
```

<br>

---

### 🏗️ Architecture

The Whisper transcriber requires GPU-enabled instances ([g4dn.2xlarge](https://aws.amazon.com/ec2/instance-types/g4/) for `large` models, and [g4dn.xlarge](https://aws.amazon.com/ec2/instance-types/g4/) for other models) to run transcription jobs. It is also optionally compatible with CPU based instances, in which case it will run [c6a.2xlarge](https://aws.amazon.com/ec2/instance-types/c6a/) instances.

To orchestrate transcriptions, this middleware deploys an ECS auto-scaled cluster of containers that consume documents from the middleware input queue. The cluster is deployed in the private subnet of the given VPC, and caches the models on an EFS storage to optimize cold-starts.

> ℹ️ The average cold-start for the Whisper transcriber is around 3 minutes when no instances are running.

![Whisper Transcriber Architecture](../../../assets/whisper-transcriber-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `audio/mpeg` | MP3 audio documents. |
| `audio/mp4` | MP4 audio documents. |
| `audio/x-m4a` | M4A audio documents. |
| `audio/wav` | WAV audio documents. |
| `audio/webm` | WEBM audio documents. |
| `audio/flac` | FLAC audio documents. |
| `audio/x-flac` | FLAC audio documents. |

##### Supported Outputs

|  Mime Type  | Description |
| ----------- | ----------- |
| `application/x-subrip` | SRT subtitle documents. |
| `text/vtt` | VTT subtitle documents. |
| `text/plain` | TXT subtitle documents. |
| `text/tab-separated-values` | TSV subtitle documents. |
| `application/json` | JSON subtitle documents. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware supports CPU compute. |
| `GPU` | This middleware supports GPU compute. |

<br>

---

### 📖 Examples

- [Whisper Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/transcription-pipelines/whisper-pipeline) - Builds a pipeline for transcribing audio documents using the OpenAI Whisper model.
