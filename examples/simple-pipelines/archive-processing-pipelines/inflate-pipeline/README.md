# 🎈 Inflate Pipeline

> In this very simple example, we showcase how to use the Zip and Tar inflate middlewares to automatically extract the content of archives on-the-fly within a Lakechain pipeline.

The pipeline in this example takes Zip, Tar and Tar Gzipped archives from a source S3 bucket, deflates them using one of the appropriate processors and stores the deflated content in a destination S3 bucket.

## :dna: Pipeline

```mermaid
flowchart LR
  Bucket([S3 Bucket]) -.-> S3[S3 Trigger]
  S3[S3 Trigger] -. Zip .-> Unzip[Unzip Processor]
  S3[S3 Trigger] -. Tar .-> Untar[Untar Processor]
  Unzip[Unzip Processor] -. Files .-> Storage[S3 Storage Connector]
  Untar[Untar Processor] -. Files .-> Storage[S3 Storage Connector]
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

Head to the directory [`examples/simple-pipelines/archive-processing-pipelines/inflate-pipeline`](/examples/simple-pipelines/archive-processing-pipelines/inflate-pipeline) in the repository and run the following commands to build the example:

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
