# 🐶 Bark Synthesizer

> In this example, we showcase how to ingest text documents and synthesize them into audio files using the [Bark](https://github.com/suno-ai/bark) text-to-speech model running on AWS.

The Bark model is deployed by the `Bark Synthesizer` middleware as a container on AWS ECS running on a GPU accelerated instance. The middleware transparently auto-scales the number of instances required based on the number of documents to process. You can use the Bark model to synthesize short or longer text documents into MPEG audio files.

## :dna: Pipeline

```mermaid
flowchart LR
  Bucket([S3 Bucket]) -.-> S3[S3 Trigger]
  S3 -. Text .-> NLP[NLP Text Processor]
  NLP -. Text .-> Bark[Bark Synthesizer]
  Bark -. Audio .-> S3Storage[S3 Storage Connector]
  S3Storage -.-> Output[Output Bucket]
```

## 📝 Requirements

The following requirements are needed to deploy the infrastructure associated with this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v18+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/simple-pipelines/text-to-speech-pipelines/bark-synthesizer`](/examples/simple-pipelines/text-to-speech-pipelines/bark-synthesizer) in the repository and first run `npm` to install the pipeline dependencies:

```bash
npm install
npm run build-pkg
```

You can then deploy the example to your account (ensure your AWS CDK is configured with the appropriate AWS credentials and AWS region):

```bash
npm run deploy
```

## 🧹 Clean up

Don't forget to clean up the resources created by this example by running the following command:

```bash
npm run destroy
```
