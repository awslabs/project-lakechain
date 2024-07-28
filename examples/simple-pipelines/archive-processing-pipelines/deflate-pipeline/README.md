# 🗄️ Deflate Pipeline

> In this very simple example, we showcase how to Zip and create Tarballs packaging multiple documents into a compressed archive.

The pipeline in this example takes an image as an input, produces multiple size variations of that image, and then packages all images together on-the-fly into a Zip and Tar archive. The resulting archives are then stored in a destination S3 bucket.

## :dna: Pipeline

```mermaid
flowchart LR
  Bucket([S3 Bucket]) -.-> S3[S3 Trigger]
  S3 -. Image .-> Sharp1[Sharp Image Transform]
  S3 -. Image .-> Sharp2[Sharp Image Transform]
  S3 -. Image .-> Sharp3[Sharp Image Transform]
  S3 -. Image .-> Reducer[Reducer]
  Sharp1 -. Image .-> Reducer[Reducer]
  Sharp2 -. Image .-> Reducer
  Sharp3 -. Image .-> Reducer
  Reducer -. Aggregated document .-> Zip[Zip Deflate Processor]
  Reducer -. Aggregated document .-> Tar[Tar Deflate Processor]
  Zip -. Archive .-> Storage[S3 Storage Connector]
  Storage -.-> Output[Output Bucket]
  Tar -. Archive .-> Storage[S3 Storage Connector]
  Storage -.-> Output[Output Bucket]
```

## 📝 Requirements

The following requirements are needed to deploy the infrastructure associated with this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v20+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/simple-pipelines/archive-processing/deflate-pipeline`](/examples/simple-pipelines/archive-processing-pipelines/deflate-pipeline) in the repository and run the following commands to build the example:

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
