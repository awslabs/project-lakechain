# 🎬 Building a Video Chaptering Service

> 👉 This example showcases how to build a video chaptering service using Project Lakechain. _Please note that this is only an example of what can be built using Project Lakechain, and not a production-ready application._

## :dna: Pipeline

```mermaid
flowchart LR
  Bucket[S3 Bucket] -.-> S3[S3 Event Trigger]
  S3 -. Video .-> FFMPEGAudio[FFMPEG Processor]
  FFMPEGAudio -. Audio .-> Transcribe[Transcribe Audio Processor]
  Transcribe -. Text .-> Anthropic[Anthropic Text Processor]
  Anthropic -. Text .-> Transform[Transform Processor]
  Transform -. Text .-> Reducer[Reducer]
  Transform -. Text .-> Reducer[Reducer]
  Reducer -. Chapters + Video .-> FFMPEGVideo[FFMPEG Processor]
  FFMPEGVideo -. Videos .-> S3Storage[S3 Storage Connector]
  FFMPEGVideo -. Videos .-> S3Storage[S3 Storage Connector]
  S3Storage -. Videos .-> S3Destination[S3 Destination Bucket]
```

## What does this example do ❓

This example showcases how to automatically chapter videos using their transcript and Generative AI on Amazon Bedrock.

> 💁 The pipeline takes an input video from the pipeline source bucket and outputs a collection of chaptered videos and a JSON description of the generated chapters.

<br />
<p align="center">
  <img width="650" src="./assets/diagram.png" />
</p>
<br />

The sequence of processing steps in the pipeline goes as follows.

1. The pipeline is triggered by a video upload to a source S3 bucket.
2. The FFMPEG Processor extracts the audio from the video.
3. The audio is transcribed into text using the Transcribe Audio Processor.
4. The text is processed by the Anthropic Text Processor to generate a list of chapters from the transcript.
5. The output of the Anthropic Text Processor is parsed to ensure that the chapters are correctly formatted as a JSON document.
6. The reducer will reduce both the input video and the chapters into a single document.
7. The FFMPEG Processor will then use the reduced document to generate multiple videos associated with each chapter.
8. The generated videos are then uploaded to a destination S3 bucket along with the chapters.

## 📝 Requirements

The following requirements are needed to deploy the infrastructure required to run this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v18+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/end-to-end-use-cases/building-a-video-chaptering-service`](/examples/end-to-end-use-cases/building-a-video-chaptering-service) in the Project Lakechain repository and build the example and its dependencies.

```bash
npm install
npm run build-pkg
```

You can then deploy the example to your account (ensure your deployment machine is configured with the appropriate AWS credentials and AWS region).

```bash
npm run deploy
```

## 🧹 Clean up

Don't forget to clean up the resources created by this example by running the following command:

```bash
npm run destroy
```
