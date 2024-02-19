# 🖼️ Clip Embedding Pipeline

> In this example, we showcase how to create vector embeddings for images using the [OpenAI CLIP](https://github.com/openai/CLIP) model, hosted on AWS.

[Vector embeddings](https://www.pinecone.io/learn/vector-embeddings/) are a type of representation for data, usually words or images, where similar items have similar representations in a multi-dimensional space. Think of them as a way to translate complex items, like words or pictures, into lists of numbers (which we call vectors) that capture their semantics and relationships to other items.

Creating such vector embeddings for multi-modal documents can be very useful for a range of use-cases such as document classification, personalized recommendations, or building an internal search engine for your business.

## :dna: Pipeline

```mermaid
flowchart LR
  Input([Input Bucket]) -.-> S3[S3 Trigger]
  S3 --> CLIP[CLIP Processor]
  CLIP --> S3Storage[S3 Connector]
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

Head to the directory [`examples/simple-pipelines/embedding-pipelines/clip-embeddings-pipeline`](/examples/simple-pipelines/embedding-pipelines/clip-embeddings-pipeline) in the repository and run the following commands to build the example:

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
