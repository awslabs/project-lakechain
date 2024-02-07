# :package: OpenSearch Domain

---

![Static Badge](https://img.shields.io/badge/Project-Lakechain-danger?style=for-the-badge&color=green) ![Static Badge](https://img.shields.io/badge/API-unstable-danger?style=for-the-badge&color=orange)

---

## Overview

The `OpenSearch Domain` construct is an internal construct helper part of [Project Lakechain](https://github.com/awslabs/project-lakechain) and is mainly used for example purposes. It allows to easily create an OpenSearch Domain in a VPC with Cognito integration for authenticating users to the OpenSearch dashboard.

## Usage

You can instantiate the construct in your CDK stack by specifying the VPC in which the domain should be created. This will create a new OpenSearch domain, a new Cognito user pool, a new security group for controlling access to the domain, and a new Cognito identity pool allowing users to authenticate with the domain's dashboard interface.

```typescript
import { OpenSearchDomain } from '@project-lakechain/opensearch-domain';

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    const openSearch = new OpenSearchDomain(this, 'Domain', {
      vpc: reference_your_vpc
    });
  }
}
```

### Overriding domain parameters

You can provide your own domain parameters by partially specifying them in the `opts` property of the construct. For example, to customize the instance type for your domain, you can do the following :

> You can override any property of the domain using the `opts` property.

```typescript
import { OpenSearchDomain } from '@project-lakechain/opensearch-domain';

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    const openSearch = new OpenSearchDomain(this, 'Domain', {
      vpc,
      opts: {
        capacity: {
          dataNodeInstanceType: 't3.small.elasticsearch'
        }
      }
    });
  }
}
```

### Using an existing Cognito User Pool

If you already created a Cognito User Pool in your CDK stack that you would like this construct to use as an authenticating mechanism, you can simply pass your `cognito.UserPool` instance to the construct through its `existingUserPool` property :

```typescript
import { OpenSearchDomain } from '@project-lakechain/opensearch-domain';

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    const userPool = new cognito.UserPool(this, 'UserPool', {
      // ...
    });

    const openSearch = new OpenSearchDomain(this, 'Domain', {
      vpc,
      existingUserPool: userPool
    });
  }
}
```

### Construct properties

When you create the `OpenSearchDomain` construct, it exposes the following properties that you can use in your code :

| Property        | Type                | Description                                                                       |
| --------------- | ------------------- | --------------------------------------------------------------------------------- |
| `domain`        | `opensearch.Domain` | The OpenSearch Domain created by the construct.                                   |
| `userPool`      | `cognito.UserPool`  | The Cognito User Pool created by the construct.                                   |
| `securityGroup` | `ec2.SecurityGroup` | The Security Group created by the construct for controlling access to the domain. |

## Access Policies

This construct will create 2 access policies for the OpenSearch domain :

- A policy allowing `es:ESHttpGet` and `es:ESHttpPost` access to the domain from any IAM principal in the current account that has access to the VPC in which the domain is deployed. This allows to decouple the identity-based access control from the resource-based access control on the domain. Note that other IAM principals (such as an AWS Lambda IAM role) will still need to have the required identity-based permissions control to access the domain.
- A policy allowing the Cognito authenticated role full access to the domain, allowing users to manage the domain through the OpenSearch dashboard.
