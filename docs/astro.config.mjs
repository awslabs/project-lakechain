import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: process.env.ASTRO_SITE,
	base: '/project-lakechain',
	markdown: {
		gfm: true
  },
	integrations: [
		starlight({
			title: 'Project Lakechain',
			description: 'Build scalable document processing pipelines on AWS.',
			defaultLocale: 'en',
			favicon: '/src/assets/favicon.ico',
			logo: {
				light: '/src/assets/icon.png',
				dark: '/src/assets/icon.png',
				replacesTitle: true
			},
			customCss: [
				'./src/styles/landing.css',
				'./src/styles/font.css',
				'./src/styles/custom.css',
				'./src/styles/terminal.css'
			],
			social: {
				github: 'https://github.com/awslabs/project-lakechain'
			},
			sidebar: [{
				label: 'General',
				items: [{
					label: 'Introduction',
					link: '/general/introduction'
				}, {
					label: 'Concepts',
					link: '/general/concepts'
				}, {
					label: 'Events',
					link: '/general/events'
				}, {
					label: 'Pre-requisites',
					link: '/general/pre-requisites'
				}, {
					label: 'Quickstart',
					link: '/general/quickstart'
				}, {
					label: 'FAQ',
					link: '/general/faq'
				}]
			}, {
				label: 'Guides',
				items: [{
					label: 'Architecture',
					link: '/guides/architecture'
				}, {
					label: 'API',
					link: '/guides/api'
				}, {
					label: 'Security Model',
					link: '/guides/security-model'
				}, {
					label: 'Observability',
					link: '/guides/observability'
				}, {
					label: 'Funclets',
					link: '/guides/funclets'
				}, {
					label: 'Tags',
					link: '/guides/tagging'
				}, {
					label: 'Examples',
					link: '/guides/examples'
				}]
			}, {
				label: 'Triggers',
				items: [{
					label: 'S3',
					link: '/triggers/s3-event-trigger'
				}, {
					label: 'SQS',
					link: '/triggers/sqs-event-trigger'
				}, {
					label: 'Scheduler',
					link: '/triggers/scheduler-event-trigger'
				}]
			}, {
				label: 'Image Processing',
				items: [{
					label: 'Blip2',
					link: '/image-processing/blip2-image-processor'
				}, {
					label: 'Sharp',
					link: '/image-processing/sharp-image-transform'
				}, {
					label: 'Metadata',
					link: '/image-processing/image-metadata-extractor'
				}, {
					label: 'Image Drawing',
					link: '/image-processing/image-layer-processor'
				}, {
					label: 'Rekognition',
					link: '/image-processing/rekognition-image-processor'
				}, {
					label: 'Background Removal',
					link: '/image-processing/rembg-image-processor'
				}]
			}, {
				label: 'Embeddings',
				items: [{
					label: 'Bedrock',
					link: '/embedding-processing/bedrock-embedding-processor'
				}, {
					label: 'Sentence Transformers',
					link: '/embedding-processing/sentence-transformers'
				}, {
					label: 'CLIP',
					link: '/embedding-processing/clip-image-processor'
				}, {
					label: 'PANN',
					link: '/embedding-processing/panns-embedding-processor'
				}]
			}, {
				label: 'Generative AI',
				items: [{
					label: 'Anthropic',
					link: '/generative-ai/anthropic-text-processor'
				}, {
					label: 'AI21',
					link: '/generative-ai/ai21-text-processor'
				}, {
					label: 'Cohere',
					link: '/generative-ai/cohere-text-processor'
				}, {
					label: 'Llama',
					link: '/generative-ai/llama-text-processor'
				}, {
					label: 'Mistral',
					link: '/generative-ai/mistral-text-processor'
				}, {
					label: 'Titan',
					link: '/generative-ai/titan-text-processor'
				}, {
					label: 'Titan Images',
					link: '/generative-ai/titan-image-generator'
				}, {
					label: 'SDXL',
					link: '/generative-ai/sdxl-image-generator'
				}, {
					label: 'Ollama',
					link: '/generative-ai/ollama-processor'
				}]
			}, {
				label: 'Connectors',
				items: [{
					label: 'OpenSearch',
					link: '/connectors/opensearch-storage-connector'
				}, {
					label: 'OpenSearch Vectors',
					link: '/connectors/opensearch-vector-storage-connector'
				}, {
					label: 'Pinecone',
					link: '/connectors/pinecone-storage-connector'
				}, {
					label: 'S3',
					link: '/connectors/s3-storage-connector'
				}, {
					label: 'SQS',
					link: '/connectors/sqs-storage-connector'
				}, {
					label: 'Firehose',
					link: '/connectors/firehose-storage-connector'
				}]
			}, {
				label: 'Text Processing',
				items: [{
					label: 'BERT Summarizer',
					link: '/text-processing/bert-extractive-summarizer'
				}, {
					label: 'KeyBERT',
					link: '/text-processing/keybert-text-processor'
				}, {
					label: 'Newspaper3k',
					link: '/text-processing/newspaper3k'
				}, {
					label: 'Email',
					link: '/text-processing/email-text-processor'
				}, {
					label: 'NLP',
					link: '/text-processing/nlp-text-processor'
				}, {
					label: 'Pandoc',
					link: '/text-processing/pandoc-text-converter'
				}, {
					label: 'PDF',
					link: '/text-processing/pdf-text-converter'
				}, {
					label: 'RSS Feeds',
					link: '/text-processing/syndication-feed-processor'
				},{
					label: 'Text Transform',
					link: '/text-processing/text-transform-processor'
				}, {
					label: 'Translate',
					link: '/text-processing/translate-text-processor'
				}, {
					label: 'JMESPath',
					link: '/text-processing/jmespath-processor'
				}, {
					label: 'Subtitles',
					link: '/text-processing/subtitle-processor'
				}]
			}, {
				label: 'Audio Processing',
				items: [{
					label: ' Metadata',
					link: '/audio-processing/audio-metadata-extractor'
				}, {
					label: 'Bark',
					link: '/audio-processing/bark-synthesizer'
				}, {
					label: 'Polly',
					link: '/audio-processing/polly-synthesizer'
				}, {
					label: 'Transcribe',
					link: '/audio-processing/transcribe-audio-processor'
				}, {
					label: 'Whisper',
					link: '/audio-processing/whisper-transcriber'
				}]
			}, {
				label: 'Text Splitters',
				items: [{
					label: 'Character Text Splitter',
					link: '/text-splitters/character-text-splitter'
				}, {
					label: 'Recursive Text Splitter',
					link: '/text-splitters/recursive-character-text-splitter'
				}, {
					label: 'Sentence Text Splitter',
					link: '/text-splitters/sentence-text-splitter'
				}, {
					label: 'Tiling Text Splitter',
					link: '/text-splitters/tiling-text-splitter'
				}, {
					label: 'Regexp Text Splitter',
					link: '/text-splitters/regexp-text-splitter'
				}]
			}, {
				label: 'Flow Control',
				items: [{
					label: 'Passthrough',
					link: '/flow-control/passthrough'
				}, {
					label: 'Delay',
					link: '/flow-control/delay'
				}, {
					label: 'Condition',
					link: '/flow-control/condition'
				}, {
					label: 'Reducer',
					link: '/flow-control/reducer'
				}]
			}, {
				label: 'Video Processing',
				items: [{
					label: 'Metadata Extractor',
					link: '/video-processing/metadata-extractor'
				}, {
					label: 'FFMPEG',
					link: '/video-processing/ffmpeg-processor'
				}]
			}, {
				label: 'Archive Processing',
				items: [{
					label: 'Untar',
					link: '/archive-processing/tar-inflate-processor'
				}, {
					label: 'Zip',
					link: '/archive-processing/zip-deflate-processor'
				}, {
					label: 'Unzip',
					link: '/archive-processing/zip-inflate-processor'
				}]
			}]
		})
	]
});
