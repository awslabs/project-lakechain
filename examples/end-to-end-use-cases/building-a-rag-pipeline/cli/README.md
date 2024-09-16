<br />
<p align="center">
  <img width="750" src="../assets/cli.png">
</p>
<br />

## Overview

This command-line interface gives an example of how customers can implement Retrieval Augmented Generation (RAG) using the [RAG Pipeline](../) example.

While the pipeline itself processes documents, creates embeddings for each of their chunks, and stores those embeddings in Amazon OpenSearch, this CLI allows you to ask questions to your documents stored in OpenSearch using a large language model powered by Amazon Bedrock.

## Install

To use this tool, you first need to install its dependencies and build it.

```bash
npm install
```

> The result of the build will be located in the `dist/` directory.

## Access the VPC

Because OpenSearch is deployed in a VPC private subnet for security reasons, you will need to get access to the VPC to run this tool, as it will need to query your OpenSearch index. To do so, you have a few options.

### Sshuttle

You can use an EC2 bastion host in the same VPC as the deployed example to establish a soft VPN connection to your VPC using [`sshuttle`](https://github.com/sshuttle/sshuttle). This way you local computer will be able to access instances within the example VPC as if they were on your local network.

### Port Forwarding

You can use the [AWS Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html) to access the VPC from your local machine using port forwarding.

```bash
aws ssm start-session \
    --region <your region> \
    --target <your bastion instance id> \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters host="<your opensearch endpoint>", portNumber="443", localPortNumber="8443"
```

## Usage

Run the CLI by passing it with the required configuration.

> **Note**
> You can also omit any parameters and let the command-line tool prompt you for the missing information.

```bash
npx tsx --tsconfig tsconfig.json src/index.ts \
  --opensearch-endpoint 'https://vpc-opensearch-vectors-example.eu-west-1.es.amazonaws.com' \
  --opensearch-region eu-west-1 \
  --bedrock-region us-east-1
```
