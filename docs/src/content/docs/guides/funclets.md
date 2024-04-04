---
title: Funclets
---

This section will dive into the concept of *funclets*, what they are, why we've created them, and how their gradual adoption across middlewares will enable developers to express more versatile and custom document processing pipelines using Lakechain.

<br />

---

## 🧩 Introduction

The aim of Project Lakechain is to provide a low(-er) code experience for builders allowing them to prototype complex document processing pipelines using advanced machine-learning capabilities on AWS in a quick, simple, and yet very scalable way.

To do so, we've created dozens of middlewares that "speak" the same ubiquitous language and can be combined in a variety of ways to transform, aggregate, and analyze documents. While providing ready made generic components is an important value of the framework, and despite having flow control structures such as conditions, and map-reduce semantics which can be used as distributed loops, the DAG representation of pipelines is not [turing-complete](https://en.wikipedia.org/wiki/Turing_completeness).

This essentially means that the amount of combinations and use-cases which developers can create using DAGs is very limited compared to turing-complete programming language (e.g JavaScript, Python, Rust, etc.) which do not yield such limitations.

Another fundamental limitation, is the inability to express complex user intents in a declarative way. Let's take the example of the [FFMPEG](/project-lakechain/video-processing/ffmpeg) middleware which enables builders to perform audio and video processing within a pipeline. How can we harness the full power, and millions of possible processing combinations provided by FFMPEG in a mere declarative way without using code? It's difficult, and would lead to the creation of overly complex description languages trying to achieve what existing languages are capable of in the first place.

To address those conundrums, and keep a good balance between simplicity and power, we're introducing the concept of funclets in Project Lakechain.

<br />

---

## What's a Funclet ❓

A funclet is a small function expression written in TypeScript that is passed to a middleware to customize its behavior using code. Think of them as lightweight user-defined callbacks that are executed at runtime in the Cloud to customize a behavior.

While middlewares focus on alleviating the complexity of infrastructure definition, funclets focus on customizing the business logic that truly matters to customers.

<br />

---

### 🧑‍🎨 Example

Below is a very simple example of a funclet using the [`Condition`](/project-lakechain/flow-control/condition) middleware enabling developers to express complex conditions in native TypeScript.

```typescript
const condition = new Condition.Builder()
  .withScope(this)
  .withIdentifier('Condition')
  .withCacheStorage(cache)
  .withSource(trigger)
  // 👇 Funclet
  .withConditional(async (event: CloudEvent) => {
    return (event.data().metadata().properties.kind !== 'image');
  })
  .build();
```

The conditional expression is expressed as a regular function in your CDK code, which gets serialized at *deployment time* and called back at *runtime* by the `Condition` middleware for each processed document — completely transparently!

<br />

---

### 🛠️ Details

The signature of funclets depends on the use-case and are specific to each middleware. However, all funclets can perform asynchronous operations — such as loading the content of a document in memory to act on it — and do return a promise.

Funclets can be defined as TypeScript named functions, anonymous functions, or arrow functions within your CDK code, and are serialized by the framework when deploying your CDK stack to your AWS account. We use [`esbuild`](https://esbuild.github.io/) to verify, transpile, and minify funclets before deploying them to AWS.

The execution of funclets is performed by middlewares in a V8 [virtual machine](https://nodejs.org/api/vm.html) within a separate context. They are run in the same process as the middleware code, and don't require additional infrastructure. Using V8 VMs provides an overall very efficient way to run user-defined code in milliseconds.

<br />

---

## ℹ️ Limits

> 💁 **Important** - One current limit of funclets is that you cannot use expressions located outside of the scope of the funclet closure. All variables must be self-contained within the scope of the funclet.

For example, the below funclet definition would throw an error when being evaluated at runtime as it is referencing a variable out of its current scope in the CDK code, that does not exist in the cloud.

```typescript
// Outter scope.
const outside = 1;

const funclet = async (event: CloudEvent) => {
  // `outside` will be undefined here.
  return (event.data().id() === outside);
};
```

<br />

---

## 🚀 More Examples

To find out about how funclets are used in real-life use-cases, you will find below a set of examples leveraging funclets.

- [Building a Generative Podcast](https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-podcast-generator) - Builds a pipeline for creating a generative weekly AWS news podcast.
- [Building a Video Chaptering Service](https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-video-chaptering-service) - Builds a pipeline for automatic video chaptering generation.
