---
title: Introduction
description: Introduction to Project Lakechain
---

Today, the [wide-majority](https://mitsloan.mit.edu/ideas-made-to-matter/tapping-power-unstructured-data) of the world data is considered [unstructured](https://en.wikipedia.org/wiki/Unstructured_data). This includes documents such as free-form text, unlabeled images, raw videos or audio files, that don't adhere to a specific data-model, and don't hold the structural elements required to extract the semantics they convey using a computer.

To make sense of their data, our customers need to resort to complex processing operations such as ETL jobs, Map-Reduce transforms, usage of OCR and Computer Vision tools, as well as various other Machine-learning models. This not only requires a lot of engineering efforts in understanding how to exploit documents, but also requires deep infrastructure knowledge to scale these operations into coherent document processing pipelines.

In a world where Generative AI is reshaping the way customers are integrating and interacting with their data, it is increasingly important for them to be able to rapidly explore, transform, enrich their existing data lakes of documents with the scale, resiliency and cost-efficiency that the AWS cloud provides.

## 🚀 Motivation

To address these challenges, and empower customers to quickly experiment complex document processing tasks on AWS, such as [Retrieval Augmented Generation (RAG)](https://docs.aws.amazon.com/sagemaker/latest/dg/jumpstart-foundation-models-customize-rag.html) pipelines, and ally awesome data-science with solid infrastructure, we've built **Project Lakechain**.

Project Lakechain is a framework based on the [AWS Cloud Development Kit (CDK)](https://aws.amazon.com/cdk/), allowing to express and deploy scalable document processing pipelines on AWS using infrastructure-as-code. It emphasizes on modularity and extensibility of pipelines, and provides 40+ ready to use components for prototyping complex processing pipelines that scale out of the box to millions of documents.

This project has been designed to address a wide array of use-cases including *metadata extraction*, *document conversion*, *NLP analysis*, *text summarization*, *text translations*, *audio transcriptions*, and much more!

## 🔖 Features

Below are some of the high-level features we've baked into Project Lakechain, and we'll be exploring every one of them in this documentation.

- 🤖 Composable — Composable API to express document processing pipelines using middlewares.
- ☁️ Scalable — Scales out-of-the box. Process millions of documents, scale to zero automatically when done.
- ⚡ Cost Efficient — Uses cost-optimized architectures to reduce costs and drive a pay-as-you-go model.
- 🚀 Ready to use — 40+ built-in middlewares for common document processing tasks, ready to be deployed.
- 🦎 GPU and CPU Support — Use the right compute type to balance between performance and cost.
- 📦 Bring Your Own — Create your own transform middlewares to process documents and extend Lakechain.
- 📙 Ready Made Examples - QuickStart your journey by leveraging [40+ examples](https://github.com/awslabs/project-lakechain/tree/main/examples) we've built for you.
