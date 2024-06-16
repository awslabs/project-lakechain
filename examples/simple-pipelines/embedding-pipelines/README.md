# 🤖 Embedding Pipelines

In this directory we provide several examples of embedding pipelines that showcase how to create vector embeddings for text documents using different embedding models and vector stores on AWS using Project Lakechain.

## 🌟 Examples

Below is a list of the different examples available in this directory.

Pipeline | Description | Model | Vector Store
--- | --- | --- | ---
[Bedrock + LanceDB](bedrock-lancedb-pipeline) | Generate embeddings for text documents using the [Amazon Titan](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html) text embedding model and store them in a [LanceDB](https://www.pinecone.io/) database. | Amazon Titan Embeddings | LanceDB
[Bedrock + OpenSearch](bedrock-opensearch-pipeline) | Generate embeddings for text documents using the [Amazon Titan](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html) text embedding model and store them in an [OpenSearch](https://opensearch.org/) index. | Amazon Titan Embeddings | Amazon OpenSearch
[Bedrock + Pinecone](bedrock-pinecone-pipeline) | Generate embeddings for text documents using the [Amazon Titan](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html) text embedding model and store them in a [Pinecone](https://www.pinecone.io/) vector store. | Amazon Titan Embeddings | Pinecone
[CLIP + S3](clip-embeddings-pipeline) | Generate embeddings for images using the [OpenAI CLIP](https://openai.com/research/clip/) embedding model and store them in an S3 bucket. | OpenAI CLIP | None
[Cohere Embeddings + OpenSearch](cohere-opensearch-pipeline) | Generate embeddings for text documents using the [Cohere](https://cohere.ai/) embedding model and store them in an [OpenSearch](https://opensearch.org/) index. | Cohere on Bedrock | Amazon OpenSearch
[PANNS + OpenSearch](panns-opensearch-pipeline) | Generate embeddings for audio using the [PANNS Inference Model](https://github.com/qiuqiangkong/panns_inference) and store them in an [OpenSearch](https://opensearch.org/) index. | PANNS | Amazon OpenSearch
[Sentence Transformers + OpenSearch](sentence-transformers-pipeline) | Generate embeddings for text documents using the [Sentence Transformers](https://www.sbert.net/) embedding model and store them in an [OpenSearch](https://opensearch.org/) index. | Sentence Transformers | Amazon OpenSearch
