# 🎨 Titan Inpainting Pipeline

> In this example, we showcase how to leverage Amazon Bedrock and the Amazon Titan image model capabilities to perform image inpainting.

## :dna: Pipeline

```mermaid
flowchart LR
  Input([Input Bucket]) -.-> S3[S3 Trigger]
  S3 --> Sharp[Sharp Image Transform]
  Sharp --> Titan[Titan Image Generator]
  Titan --> S3Output[S3 Connector]
  S3Output -.-> Bucket1[Output Bucket]
```

## ❓ What is Happening

Image inpainting allows to mask a section of an image and to replace the masked section with an AI generated image. In this example we show how to use a mask prompt to mask a _house_ in an input image, and replace the house with a the following prompt: _Modern house_.

Below is an example of the result of the inpainting process executed by this example.

<p align="center">
  <img src="assets/result.png">
</p>

## 📝 Requirements

The following requirements are needed to deploy the infrastructure associated with this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v20+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/simple-pipelines/generative-pipelines//amazon-titan-inpainting-pipeline`](/examples/simple-pipelines/generative-pipelines//amazon-titan-inpainting-pipeline/) in the repository and run the following commands to build the example:

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
