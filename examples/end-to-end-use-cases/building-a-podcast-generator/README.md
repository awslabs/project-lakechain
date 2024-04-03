# 🎙️ Building a Generative Podcast

> 👉 This example showcases how to build an intelligent, multi-person, AWS daily news podcast generator using Project Lakechain. _Please note that this is only an example of what can be built using Project Lakechain, and not a production-ready application._

## 🌟 Examples

### Podcast (15-03-2024)

## :dna: Pipeline

```mermaid
flowchart LR
  Timer([Every 24 Hours]) -.-> Trigger[Scheduler Event Trigger]
  Trigger -. RSS Feed .-> RSS[Syndication Feed Processor]
  RSS -. HTML Article .-> Condition{Published today?}
  Condition -- Yes --> Newspaper3k[Newspaper3k Parser]

  Newspaper3k -. Articles .-> Reducer[Reducer]
  Newspaper3k -. Articles .-> Reducer[Reducer]
  Newspaper3k -. Articles .-> Reducer[Reducer]
  Reducer -. Articles .-> Anthropic[Anthropic Text Processor]

  Anthropic -. Podcast Script .-> Transform[Transform]
  Transform --> HostSynthesizer[Polly Host Synthesizer]
  Transform --> GuestSynthesizer[Polly Guest Synthesizer]

  HostSynthesizer --> VoiceReducer[Reducer]
  GuestSynthesizer --> VoiceReducer

  VoiceReducer -. Voices .-> FFMPEG[FFMPEG Processor]
  FFMPEG -. MP3 .-> S3[S3 Bucket]
```

## What does this example do ❓

This example showcases how to build an intelligent, multi-person, generative podcast using Project Lakechain.

1. The pipeline is triggered every 24 hours and fetches the latest news articles from the official [AWS RSS feed](https://aws.amazon.com/blogs/aws/feed/).
2. It filters articles to only keep those that have been released today.
3. It then processes each article to extract the relevant text from each HTML page using the `Newspaper3k` parser.
4. The extracted articles are then processed by the Anthropic text processor to generate a podcast script.
5. The script is transformed into audio using the Polly synthesizer, which generates the audio for the host and guest speakers.
6. The audio files are then concatenated using FFMPEG and uploaded to an S3 bucket.

## 📝 Requirements

The following requirements are needed to deploy the infrastructure required to run this pipeline:

- You need access to a development AWS account.
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) is required to deploy the infrastructure.
- [Docker](https://docs.docker.com/get-docker/) is required to be running to build middlewares.
- [Node.js](https://nodejs.org/en/download/) v18+ and NPM.
- [Python](https://www.python.org/downloads/) v3.8+ and [Pip](https://pip.pypa.io/en/stable/installation/).

## 🚀 Deploy

Head to the directory [`examples/end-to-end-use-cases/building-a-podcast-generator`](/examples/end-to-end-use-cases/building-a-podcast-generator) in the Project Lakechain repository and build the example and its dependencies.

```bash
npm install
npm run build-pkg
```

You can then deploy the example to your account (ensure your deployment machine is configured with the appropriate AWS credentials and AWS region).

```bash
npm run deploy
```

## 🧹 Clean up

Don't forget to clean up the resources created by this example by running the following command:

```bash
npm run destroy
```
