# 👮 Image Moderation Pipeline

> In this example, we leverage the Rekognition Image Processor middleware and conditionals to classify whether a given input image requires moderation.

## :dna: Pipeline

```mermaid
flowchart LR
  Input([Input Bucket]) -.-> S3[S3 Trigger]
  S3 -. Image .-> Rekognition[Rekognition Image Processor]
  Rekognition --> Condition{Contains Moderation Labels?}
  Condition -- Yes --> Moderated[Moderated S3 Bucket]
  Condition -- No --> NM[Non-Moderated S3 Bucket]
```

## ❓ What is Happening

This pipeline provides an example of how to classify images into different buckets: Images that require manual moderation and images that do not require moderation and can be safely used.

We use the moderation detection feature provided by the Amazon Rekognition service to do moderated content classification and provide easy ways to customize it through the Rekognition Image Processor middleware. Moderated content can include inappropriate, unwanted or offensive materials such as explicit or suggestive nudity, violence, drugs, alcohol, gambling, or hate symbols.

## 📝 Requirements

The following requirements are needed to deploy the infrastructure associated with this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v18+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/simple-pipelines/image-moderation-pipeline`](/examples/simple-pipelines/image-moderation-pipeline) in the repository and run the following commands to build the example:

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
