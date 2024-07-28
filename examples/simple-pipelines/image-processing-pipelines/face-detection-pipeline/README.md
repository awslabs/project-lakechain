# :camera: Face Detection Pipeline

> In this example, we will walk you through how to create a simple face detection pipeline to detect faces in image documents, and then transform the input image to apply some transformations.

## :dna: Pipeline

```mermaid
flowchart LR
  Input([Input Bucket]) -.-> S3[S3 Trigger]
  S3 -. Image .-> Rekognition[Rekognition Image Processor]
  Rekognition -. Image + Metadata .-> Image[Image Layer Processor]
  Image -. Modified Image .-> S3Storage[S3 Storage Connector]
  S3Storage -.-> Output[Output Bucket]
```

## ❓ What is Happening

In this example, we are using different middlewares:

- The `S3 Trigger` provides a way to trigger a new pipeline execution whenever a new object is uploaded to an S3 bucket.
- The `Rekognition Image Processor` uses Amazon Rekognition to detect faces, objects and text in images, and passes them as metadata to the next middlewares in the pipeline.
- The `Image Layer Processor` will apply a set of transformations based on the metadata created by the Rekognition Image Processor. In this case, it will pixelate faces detected in images and draw face landmarks.
- Finally, the `S3 Storage Connector` stores transformed image in a destination S3 bucket.

<br />
<p align="center">
  <img src="assets/result.png">
</p>
<br />

This showcases the power of Project Lakechain in conveying results from one middleware to the next ones in a pipeline in a common format. This way, you can pipe multiple middlewares together to create complex data processing pipelines, while keeping your middlewares decoupled from each others.

## 📝 Requirements

The following requirements are needed to deploy the infrastructure associated with this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v20+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/simple-pipelines/image-processing-pipelines/face-detection-pipeline`](/examples/simple-pipelines/image-processing-pipelines/face-detection-pipeline) in the repository and run the following commands to build the example:

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
