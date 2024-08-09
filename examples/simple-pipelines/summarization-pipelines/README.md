# ✂️ Summarization Pipelines

In this directory we provide several examples of summarization pipelines that showcase how to summarize documents using different LLMs on AWS using Project Lakechain.

## 🌟 Examples

Below is a list of the different examples available in this directory.

Pipeline | Description | Model | Document Type
--- | --- | --- | ---
[Audio Recording Summarization Pipeline](audio-recording-summarization-pipeline) | A pipeline for summarizing audio recordings using [Amazon Transcribe](https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html) and Amazon Bedrock. | Claude3 Sonnet | Audio Files
[Claude Summarization Pipeline](claude-summarization-pipeline) | A pipeline for text summarization using Claude models on Amazon Bedrock. | Claude3 Haiku | Text Documents (Txt, PDF, Docx)
[Titan Summarization Pipeline](titan-summarization-pipeline) | A pipeline for text summarization using Titan models on Amazon Bedrock. | Titan Text Premier | Text Documents (Txt, PDF, Docx)
[Extractive Summarization Pipeline](extractive-summarization-pipeline) | A pipeline for text summarization using [BERT extractive summarizer](https://pypi.org/project/bert-extractive-summarizer/). | BERT | Text Documents
[Llama Summarization Pipeline](llama-summarization-pipeline) | A pipeline for text summarization using Llama models on Amazon Bedrock. | Llama 3.1 | Text Documents (Txt, PDF, Docx)
[Ollama Summarization Pipeline](ollama-summarization-pipeline) | Builds a pipeline for text summarization using Ollama. | Llama 3 using Ollama | Text Documents (Txt, PDF, Docx)
[Video Summarization Pipeline](video-summarization-pipeline) | A pipeline for video summarization using [Amazon Transcribe](https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html) and Amazon Bedrock. | Claude3 Sonnet | Video Files
