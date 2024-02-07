# 🤖 Cohere OpenSearch Pipeline

> In this example, we showcase how to create vector embeddings for text documents using the [Amazon Bedrock](https://aws.amazon.com/bedrock/) Cohere embedding models. The embeddings are stored within an Amazon OpenSearch index automatically that you can query using your own applications.

## :dna: Pipeline

```mermaid
flowchart LR
  Input([Input Bucket]) -.-> S3[S3 Trigger]
  S3 --> TextSplitter[Text Splitter]
  TextSplitter --> Cohere[Cohere Embedding Processor]
  Cohere --> OpenSearch[OpenSearch Vector Storage]
```

## 📝 Requirements

The following requirements are needed to deploy the infrastructure associated with this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v18+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/simple-pipelines/embedding-pipelines/cohere-opensearch-pipeline`](/examples/simple-pipelines/embedding-pipelines/cohere-opensearch-pipeline) in the repository and run the following commands to build the example:

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
