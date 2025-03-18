<br><br>

<p align="center">
  <img width="240" src="docs/src/assets/icon.png">
  <br><br>
  <h2 align="center">Project Lakechain &nbsp;<img alt="Static Badge" src="https://img.shields.io/badge/Alpha-e28743"></h2>
  <p align="center">Cloud-native, AI-powered, document processing pipelines on AWS.</p>
  <p align="center">
    <a href="https://github.com/codespaces/new/awslabs/project-lakechain"><img alt="Github Codespaces" src="https://github.com/codespaces/badge.svg" /></a>
  </p>
</p>
<br>

## 🔖 Features

- 🤖 **Composable** — Composable API to express document processing pipelines using middlewares.
- ☁️ **Scalable** — Scales out-of-the box. Process millions of documents, scale to zero automatically when done.
- ⚡ **Cost Efficient** — Uses cost-optimized architectures to reduce costs and drive a pay-as-you-go model.
- 🚀 **Ready to use** — **60+** built-in middlewares for common document processing tasks, ready to be deployed.
- 🦎 **GPU and CPU Support** — Use the right compute type to balance between performance and cost.
- 📦 **Bring Your Own** — Create your own transform middlewares to process documents and extend Lakechain.
- 📙 **Ready Made Examples** - Quickstart your journey by leveraging [50+ examples](./examples/) we've built for you.

## 🌟 Examples

<br />
<p align="center">
  <table style="display: table;">
  <tr>
    <th style="min-width: 200px;">Summarize<br />Videos</th>
    <th style="min-width: 200px;">Generative<br />Audio<br />Podcast</th>
    <th style="min-width: 200px;r">Video<br />Chaptering</th>
    <th style="min-width: 200px;">RAG<br />Pipeline</th>
    <th style="width: 170px;">Face<br />Detection</th>
    <th style="width: 170px;">E-mail<br />Analysis</th>
    <th style="width: 170px;">Image<br />Inpainting</th>
    <th style="width: 170px;">Ollama on<br />AWS</th>
  </tr>
  <tr style="text-align: center">
    <td style="min-width: 200px; padding: 45px; text-align: center">
      <a href="https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/summarization-pipelines/video-summarization-pipeline">
        <img width="80" src="https://awslabs.github.io/project-lakechain/_astro/example-video-summarization.DkuRAEiI_ZvPyVU.webp" alt="Video Summarization" />
      </a>
    </td>
    <td style="min-width: 200px; padding: 40px; text-align: center">
      <a href="https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-podcast-generator">
        <img width="85" src="https://awslabs.github.io/project-lakechain/_astro/example-generative-podcast.GncA3Eg5_Z11JYzq.webp" alt="Generative Audio Podcasts" />
      </a>
    </td>
    <td style="min-width: 200px; padding: 35px; text-align: center">
      <a href="https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-video-chaptering-service">
        <img width="100" src="https://awslabs.github.io/project-lakechain/_astro/example-video-chaptering.C9wbaNce_1gsu8V.webp" alt="Video Chaptering Service" />
      </a>
    </td>
    <td style="min-width: 200px; padding: 40px; text-align: center">
      <a href="https://github.com/awslabs/project-lakechain/tree/main/examples/end-to-end-use-cases/building-a-rag-pipeline">
        <img width="80" src="https://awslabs.github.io/project-lakechain/_astro/example-rag-pipeline.oQaxUvic_vxUw7.webp" alt="RAG Pipeline" />
      </a>
    </td>
    <td style="width: 170px; padding: 40px">
        <a href="https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/image-processing-pipelines/face-detection-pipeline">
          <img width="85" src="https://awslabs.github.io/project-lakechain/_astro/example-face-detection.tVb7YLYp_UCwfn.webp" alt="Face Detection" />
        </a>
      </td>
    <td style="width: 150px; padding: 45px">
        <a href="https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/text-processing-pipelines/email-nlp-pipeline">
          <img width="75" src="https://awslabs.github.io/project-lakechain/_astro/example-email-analysis.D5P-nn1I_FNwdc.webp" alt="E-mail Analysis" />
        </a>
      </td>
    <td style="width: 170px; padding: 42px">
        <a href="https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/generative-pipelines/titan-inpainting-pipeline">
          <img width="85" src="https://awslabs.github.io/project-lakechain/_astro/example-image-inpainting.SNNMswa9_2wpDBm.webp" alt="Image Inpainting" />
        </a>
      </td>
    <td style="width: 170px; padding: 50px">
        <a href="https://github.com/awslabs/project-lakechain/tree/main/examples/simple-pipelines/summarization-pipelines/ollama-summarization-pipeline">
          <img width="65" src="https://awslabs.github.io/project-lakechain/_astro/example-ollama-on-aws.Df2_4-tI_DJhNr.webp" alt="Ollama on AWS" />
        </a>
      </td>
  </tr>
</table>
</p>
<br />

## 🚀 Getting Started

> 👉 Head to our [documentation](https://awslabs.github.io/project-lakechain/) which contains all the information required to understand the project, and quickly start building!

## What's Lakechain ❓

Project Lakechain is an experimental framework based on the [AWS Cloud Development Kit (CDK)](https://github.com/aws/aws-cdk) that makes it easy to express and deploy scalable document processing pipelines on AWS using infrastructure-as-code. It emphasizes on modularity of pipelines, and provides **40+** ready to use components for prototyping complex document pipelines that can scale out of the box to millions of documents.

This project has been designed to help AWS customers build and scale different types of document processing pipelines, ranging a wide array of use-cases including _metadata extraction_, _document conversion_, _NLP analysis_, _text summarization_, _translations_, _audio transcriptions_, _computer vision_, _[Retrieval Augmented Generation](https://docs.aws.amazon.com/sagemaker/latest/dg/jumpstart-foundation-models-customize-rag.html) pipelines_, and much more!

## Show me the code ❗

> 👇 Below is an example of a pipeline that deploys the AWS infrastructure to automatically transcribe audio files uploaded to S3, in just a few lines of code. Scales to millions of documents.

<br /><br />
<p align="center">
  <img width="600" src="assets/code.png">
</p>
<br /><br />

## LICENSE

See [LICENSE](LICENSE).
