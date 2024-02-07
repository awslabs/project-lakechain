# 🗣️ Polly Synthesizer

> In this example, we showcase how to ingest text documents in different formats and process them using the `Polly Synthesizer`` middleware powered by [Amazon Polly](https://aws.amazon.com/polly/).

The Polly synthesizer automatically throttles calls made to Amazon Polly for synthesizing text into audio files to stay within the [Amazon Polly service limits](https://docs.aws.amazon.com/polly/latest/dg/limits.html). The results of the synthesis are then stored in a destination S3 bucket.

We also use the NLP Text Processor middleware in this example pipeline in order to detect the language of the text to synthesize and select the appropriate voice to use for the synthesis.

## :dna: Pipeline

```mermaid
flowchart LR
  Bucket([S3 Bucket]) -.-> S3[S3 Trigger]
  S3 -. Text .-> NLP[NLP Text Processor]
  NLP -. Text .-> Polly[Polly Synthesizer]
  Polly -. Audio .-> S3Storage[S3 Storage Connector]
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

Head to the directory [`examples/simple-pipelines/text-to-speech-pipelines/polly-synthesizer`](/examples/simple-pipelines/text-to-speech-pipelines/polly-synthesizer) in the repository and first run `npm` to install the pipeline dependencies:

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
