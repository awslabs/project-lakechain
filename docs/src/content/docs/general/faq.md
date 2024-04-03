---
title: FAQ
---

##### What is Project Lakechain?

Project Lakechain is a framework enabling AWS customers to develop and deploy scalable and resilient document processing pipelines on AWS. Project Lakechain is built on top of the [AWS CDK](https://aws.amazon.com/cdk/), allowing to express pipelines as infrastructure-as-code and follow best-practices of repeatable, auditable and versioned infrastructure.

With Lakechain, developers can compose their pipelines using [middlewares](/project-lakechain/general/concepts#-middlewares), and model them in the shape of a [Directed Acyclic Graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph).

<br />

---

##### What's different about Project Lakechain?

Project Lakechain has been built on top of a cloud-native architecture with scale, security and cost-efficiency in mind since the very beginning. It leverages a strong foundation for high-throughput message-passing based on AWS SQS and AWS SNS, and a [security model](/project-lakechain/guides/security-model) based on AWS IAM to keep customer data secure and private.

> ℹ️ See the [Architecture Overview](/project-lakechain/guides/architecture) section for more details on the architecture of Lakechain.

By providing dozens of existing middlewares, built for the Cloud, and addressing the most common needs for processing documents using Machine-Learning, Generative AI, NLP, and Computer Vision, Project Lakechain provides an ideal blueprint for rapid prototyping and validation of ideas.

<br />

---

##### Who is Project Lakechain for?

The primary audience for Project Lakechain are developers within a Cloud, DevOps or Data-Science team looking to prototype scalable document processing pipelines on AWS using the AWS CDK.

> 💁 Project Lakechain assumes a good understanding of the AWS CDK concepts by developers. If you are new to the AWS CDK, we recommend you start by reading the [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/latest/guide/home.html).

<br />

---

##### Is Project Lakechain production-ready?

No, Project Lakechain is currently released under Alpha preview, and is intended for rapid prototyping and experimentation only. While the middlewares and the core framework are being evolved fast as we receive feedbacks and strengthen our [Roadmap](https://github.com/orgs/awslabs/projects/153), it also means that their APIs are considered unstable until we reach **1.0.0**.

We take our customer workloads very seriously, and we're currently working towards a Beta release that will contain the core features we intend to ship, full test coverage across the framework, and more stable APIs overall. We're continuously looking for feedbacks to improve Project Lakechain, and we're looking to hear from you! If you encounter bugs, regressions, or have feature requests, we'd be very happy to [listen for your feedbacks](https://github.com/awslabs/project-lakechain/issues/new/choose).

<br />

---

##### What are the requirements to use Project Lakechain?

You can find the technical requirements for using Project Lakechain in the [Pre-requisites](/project-lakechain/general/pre-requisites) section of the documentation.

<br />

---

##### Where can I find examples of pipelines?

You can find all the examples we've built for developers in the [Examples](https://github.com/awslabs/project-lakechain/tree/main/examples) directory of the Project Lakechain GitHub repository.

<br />

---

##### In what language is Project Lakechain written?

As of today, Project Lakechain is available to all users using the AWS CDK in TypeScript.

<br />

---

##### In what language are middlewares written?

While the code describing the infrastructure implemented by each middleware is written in TypeScript using the AWS CDK, the logic executed at runtime during a pipeline execution (Lambda functions, Docker containers, etc.) can be written in any language.

<br />

---

##### Can I write my own middlewares?

Yes, we are currently working on a developer handbook to help you write your own middlewares. Stay tuned!
