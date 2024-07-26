# 🇯 JMESPath Parsing Pipeline

> In this very simple example, we showcase how to use the JMESPath parsing processor to parse JSON documents and extract specific fields from them.

The pipeline in this example takes JSON documents as an input from an S3 bucket, applies a [JMESPath expression](https://jmespath.org/) to them to transform the document, and then stores the result in another S3 bucket.

In this example, we use the following JMESPath expression to extract the `name` field from an array in an input JSON document.

```jmespath
array[*].name
```

> 💁 The example JSON document is attached to this example in the file [`example.json`](/examples/simple-pipelines/jmespath-parsing-pipeline/example.json).

## :dna: Pipeline

```mermaid
flowchart LR
  Bucket([S3 Bucket]) -.-> S3[S3 Trigger]
  S3[S3 Trigger] -. JSON .-> JMESPath[JMESPath Processor]
  JMESPath[JMESPath Processor] -. JSON or Text .-> Storage[Storage Processor]
  Storage -.-> Output[Output Bucket]
```

## 📝 Requirements

The following requirements are needed to deploy the infrastructure associated with this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v18+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/simple-pipelines/jmespath-parsing-pipeline`](/examples/simple-pipelines/jmespath-parsing-pipeline) in the repository and run the following commands to build the example:

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
