# #️⃣ Image Hashing Pipeline

> In this example, we demonstrate how to compute visual hashes associated with images within a Lakechain pipeline, using different hashing algorithms.

## :dna: Pipeline

```mermaid
flowchart LR
  Input([Input Bucket]) -.-> S3[S3 Trigger]
  S3 -. Image .-> Hashing[Hashing Image Processor]
  Hashing -.-> Destination[S3 Storage Connector]
  Destination -.-> Output([Output Bucket])
```

## ❓ What is Happening

This example demonstrates how to compute the hash of images using the `Hashing Image Processor` middleware.

The pipeline is triggered when an image is uploaded to the source S3 bucket. The image is then processed by the `Hashing Image Processor` middleware which computes the hashes of the image using different hashing algorithms by default. The pipeline then stores the image and its metadata in the destination S3 bucket.

<br />
<p align="center">
  <img width="700" src="../../../docs/src/assets/image-hashing-example.png">
</p>
<br />

## 📝 Requirements

The following requirements are needed to deploy the infrastructure associated with this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v18+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/simple-pipelines/image-hashing-example`](/examples/simple-pipelines/image-hashing-example) in the repository and run the following commands to build the example:

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
