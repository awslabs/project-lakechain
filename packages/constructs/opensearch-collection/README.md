# :package: OpenSearch Collection

---

![Static Badge](https://img.shields.io/badge/Project-Lakechain-danger?style=for-the-badge&color=green) ![Static Badge](https://img.shields.io/badge/API-unstable-danger?style=for-the-badge&color=orange)

---

## Overview

The `OpenSearch Collection` construct is an internal construct helper part of [Project Lakechain](https://github.com/awslabs/project-lakechain) used to create [OpenSearch Serverless](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html) collections using the AWS CDK.

## Usage

You can instantiate the construct in your CDK stack by specifying the VPC in which the collection should be created, the name of the collection, its type, and an optional description. This will create a new OpenSearch serverless collection, a VPC endpoint in the given VPC for accessing with the collection, a [network security policy](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-security.html#serverless-security-network) and an [encryption security policy](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-security.html#serverless-security-encryption).

> ℹ️ This implementation does not allow creating collections outside of a VPC.

```typescript
import * as oss from '@project-lakechain/opensearch-collection';

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    const collection = new oss.Collection(this, 'Collection', {
      name: 'vector-collection',
      description: 'A collection used to store embeddings.',
      vpc,
      type: 'VECTORSEARCH'
    });
  }
}
```

### Adding an Access Policy

OpenSearch supports the concept of access policies to define which identity is allowed to access the collection, and what action they can perform. You can create a new access policy using this construct to allow a third-party component (e.g a Lambda function) to access the collection.

```typescript
import * as oss from '@project-lakechain/opensearch-collection';

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    const lambda = new lambda.Function(this, 'Lambda', {
      /* ... */
    });
    const collection = new oss.Collection(this, 'Collection', {
      /* ... */
    });

    // Allow the Lambda to create, delete and update the collection.
    collection.addAccessPolicy(
      this.indexName,
      ['aoss:CreateIndex', 'aoss:DeleteIndex', 'aoss:UpdateIndex'],
      [lambda.role!.roleArn]
    );
  }
}
```

### Importing an existing collection

You can construct an OpenSearch Collection construct from an existing collection by specifying some of its attributes.

```typescript
import * as oss from '@project-lakechain/opensearch-collection';

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    const collection = oss.Collection.fromCollectionAttributes(this, 'Collection', {
      collectionName: 'name',
      collectionArn: 'arn',
      collectionId: 'id',
      collectionEndpoint: 'https://id.us-east-1.es.amazonaws.com',
      dashboardEndpoint: 'https://id.us-east-1.es.amazonaws.com/_dashboard'
    });
  }
}
```

### Convert a `CfnCollection` to a Collection

You can convert a `CfnCollection` to a `Collection` by using the `Collection.fromCollectionAttributes` method.

```typescript
import * as oss from '@project-lakechain/opensearch-collection';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    // The collection name.
    const collectionName = 'foo';

    // Create the `CfnCollection`.
    const cfnCollection = new opensearchserverless.CfnCollection(this, 'CfnCollection', {
      name: collectionName,
      type: 'VECTORSEARCH'
    });

    // Convert to a Collection.
    const collection = oss.Collection.fromCollectionAttributes(this, 'Collection', {
      collectionName,
      collectionArn: cfnCollection.attrArn,
      collectionId: cfnCollection.attrId,
      collectionEndpoint: cfnCollection.attrCollectionEndpoint,
      dashboardEndpoint: cfnCollection.attrDashboardEndpoint
    });
  }
}
```
