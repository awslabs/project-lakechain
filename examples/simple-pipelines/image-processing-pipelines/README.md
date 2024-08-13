# 🖼️ Image Processing Pipelines

In this directory we provide several examples that showcase how to process and transform images using different middlewares on AWS with Project Lakechain.

## 🌟 Examples

Below is a list of the different examples available in this directory.

### AI Pipelines

Pipeline | Description | Model
--- | --- | ---
[Face Detection Pipeline](face-detection-pipeline) | An example showcasing how to build face detection pipelines using Project Lakechain. | Amazon Rekognition
[Face Extraction Pipeline](face-extraction-pipeline) | An example showcasing how to extract faces detected in images. | Amazon Rekognition
[Image Background Removal (Rembg)](image-background-removal) | A pipeline demonstrating automatic image background removal using [Rembg](https://github.com/danielgatis/rembg) running in AWS Lambda. | Rembg
[Image Background Removal (Titan)](titan-image-background-removal) | A pipeline demonstrating automatic image background removal using [Amazon Titan](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html) on Amazon Bedrock. | Amazon Titan
[Image Captioning Pipeline](image-captioning-pipeline) | A pipeline demonstrating image captioning using the [BLIP2 model](https://huggingface.co/docs/transformers/main/model_doc/blip-2). | BLIP2
[Image Moderation Pipeline](image-moderation-pipeline) | A pipeline demonstrating how to classify moderated images. | Amazon Rekognition
[Titan Object Removal Pipeline](titan-object-removal-pipeline) | An example showcasing how to perform object removal in images using Amazon Titan. | Amazon Titan

### Other Pipelines

Pipeline | Description
--- | ---
[Image Hashing Pipeline](image-hashing-pipeline) | An example showcasing how to compute the hash of images.
[Image Resize Pipeline](image-resize-pipeline) | A pipeline showcasing how to resize images to multiple sizes.
[Image Transforms Pipeline](image-transforms-pipeline) | A pipeline showcasing how to transform images.
[Image Watermarking Pipeline](image-watermarking-pipeline) | A pipeline demonstrating how to watermark images.
[Laplacian Variance Pipeline](laplacian-variance-pipeline) | An example showcasing how to compute the Laplacian variance of images.
