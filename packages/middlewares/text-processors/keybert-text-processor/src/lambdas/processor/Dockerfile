FROM public.ecr.aws/lambda/python:3.11

# Add requirements to the layer.
COPY requirements.txt ./

# Install Python dependencies and sentence-transformers
# without its dependencies, as we want to avoid pulling
# Nvidia dependencies on a CPU-only container.
RUN pip install \
    --no-cache-dir \
    -r requirements.txt && \
  pip install \
    --no-cache-dir \
    --no-deps \
    sentence-transformers==2.2.2

# Download the 'punkt' and 'stopwords' NLTK packages in the lambda
# user directory.
RUN python3 -m nltk.downloader \
    --dir /home/sbx_user1051/nltk_data \
    punkt \
    stopwords

# Copy application files in the container.
COPY . ./

CMD ["index.lambda_handler"]
