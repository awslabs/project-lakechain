---
title: Condition
---

<span title="Label: Pro" data-view-component="true" class="Label Label--api text-uppercase">
  Unstable API
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--version text-uppercase">
  0.9.0
</span>
<span title="Label: Pro" data-view-component="true" class="Label Label--package">
  <a target="_blank" href="https://www.npmjs.com/package/@project-lakechain/condition">
    @project-lakechain/condition
  </a>
</span>
<span class="language-icon">
  <svg role="img" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" style="fill: #3178C6;"><title>TypeScript</title><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
</span>
<div style="margin-top: 26px"></div>

---

The `Condition` middleware allows developers to express complex conditional expressions within their document processing pipelines, that wouldn't be possible using [Filter Expressions](/project-lakechain/guides/api#filters).

With conditional expressions you can either express your conditions using a [Funclet](/project-lakechain/guides/funclets) in your CDK code and have it executed in the cloud at runtime, or you can provide a Lambda function that gets synchronously invoked to evaluate the condition.

---

### ❓ Using Conditions

To use this middleware, you import it in your CDK stack and instantiate it as part of a pipeline. You can define a funclet in TypeScript that will get serialized by Lakechain and evaluated at runtime.

> 💁 In this example, we create a simple condition that verifies whether the `version` field in JSON documents is equal to `1.0.0`.

```typescript
import * as cdk from 'aws-cdk-lib';
import { Condition } from '@project-lakechain/condition';
import { CacheStorage } from '@project-lakechain/core';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    const cache = new CacheStorage(this, 'Cache');

    // 👇 The below expression will be executed in the cloud at runtime.
    const expression = async (event: CloudEvent) => {
      const document = event.data().document();

      // Load the document in memory.
      const data = JSON.parse(
        (await document.data().asBuffer()).toString('utf-8')
      );

      // Return a boolean value.
      return (data.version === '1.0.0');
    };

    // A condition step that evaluates the above expression.
    const condition = new Condition.Builder()
      .withScope(this)
      .withIdentifier('Condition')
      .withCacheStorage(cache)
      .withSource(source)
      .withConditional(expression) // 👈 Specify the conditional expression.
      .build();
    
    // Create a matching branch.
    condition.onMatch(middleware1);

    // Create a non-matching branch.
    condition.onMismatch(middleware2);
  }
}
```

<br>

---

#### Funclet Signature

Funclet expressions use the power of a full programming language to express complex conditions. They are asynchronous and can be defined as TypeScript named functions, anonymous functions, or arrow functions.

Each conditional funclet takes a `CloudEvent` describing the document being processed as an input argument, and must return a promise to a boolean value representing the result of the evaluation.

```typescript
type ConditionalExpression = (event: CloudEvent) => Promise<boolean>;
```

<br>

---

### Conditions + Filters = ❤️

You can use conditions in conjunction with filters to use the best of both worlds. For example, filters can be used to filter-out document types that don't match a specific mime type, while conditions can be applied on the content of those filtered documents.

> 💁 Below, we filter-out every document that is not a JSON document, and then apply a condition to verify whether the `version` field is equal to `1.0.0`.

<details>
  <summary>Click to expand example</summary>

```typescript
import * as cdk from 'aws-cdk-lib';
import { Condition } from '@project-lakechain/condition';
import { CacheStorage } from '@project-lakechain/core';
import { when } from '@project-lakechain/core/dsl';

class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    const cache = new CacheStorage(this, 'Cache');

    // Only listen for JSON documents.
    const filter = when('data.document.type').equals('application/json');

    // A condition that verifies the version field.
    const condition = new Condition.Builder()
      .withScope(this)
      .withIdentifier('Condition')
      .withCacheStorage(cache)
      .withSource(source, filter) // 👈 Specify the filter
      .withConditional(async (event: CloudEvent) => {
        const document = event.data().document();
        const data = JSON.parse(
          (await document.data().asBuffer()).toString('utf-8')
        );
        return (data.version === '1.0.0');
      })
      .build();

    // Create a matching branch.
    condition.onMatch(middleware1);

    // Create a non-matching branch.
    condition.onMismatch(middleware2);
  }
}
```

</details>

<br>

---

### λ Using Lambda Functions

For even more complex conditions that would require additional package dependencies, you can specify a Lambda function instead of a funclet to the `.withConditional` API. The Lambda function will get synchronously invoked to evaluate the condition at runtime and must return a boolean value.

```typescript
import * as lambda from '@aws-cdk/aws-lambda';

const lambda: lambda.IFunction = // ...

const condition = new Condition.Builder()
  .withScope(this)
  .withIdentifier('Condition')
  .withCacheStorage(cache)
  .withSource(source)
  .withConditional(lambda) // 👈 Specify a Lambda function
  .build();
```

<br>

---

### ↔️ Conditions vs. Filters

To help you decide whether you should use conditions in your pipelines, we've created the below table that draws a comparison between Conditional Expressions provided by this middleware and [Filter Expressions](/project-lakechain/guides/api#filters).

| Feature  | Conditions | Filter Expressions | Description |
| -------- | ---------- | ------------------ | ----------- |
| **Scalability** | ✅ | ✅ | Both approaches are very scalable. |
| **Attribute-based filtering** | ✅ | ✅ | Filter based on Cloud Events attributes. |
| **Content-based filtering** | ✅ | ❌ | Filter based on the content of the document. |
| **Complex Conditions** | ✅ | ❌ | Express complex conditions supporting all logical operators. |
| **Underlying System** | AWS Lambda | Payload-based SNS Filtering | The underlying systems powering conditions and filters. |
| **Pricing** | 0.53$ per million document | 0.09$ per million document | The pricing model for conditions and filters<sup>1</sup>. |

<sup>1</sup> Pricing is based on the following assumptions :
- 1 million documents attributes (1KB each) processed by SNS filtering
- AWS Lambda running for 200ms per document, 128MB memory size, no free tier usage.

<br>

---

### 🏗️ Architecture

The `Condition` middleware is built on top of AWS Lambda. It uses an internal V8 virtual machine within the Lambda environment to evaluate conditions.

![Condition Architecture](../../../assets/condition-architecture.png)

<br>

---

### 🏷️ Properties

<br>

##### Supported Inputs

| Mime Type | Description |
| --------- | ----------- |
| `*/*`     | The condition middleware can consume any type of document. |

##### Supported Outputs

| Mime Type | Description |
| --------- | ----------- |
| `*/*`     | The condition middleware can produce any type of document. |

##### Supported Compute Types

| Type  | Description |
| ----- | ----------- |
| `CPU` | This middleware only supports CPU compute. |

<br>

---

### 📖 Examples

- [Conditional Pipeline](https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/flow-control-pipelines/conditional-pipeline) - An example showcasing how to use conditional expressions in pipelines.
