FROM public.ecr.aws/lambda/python:3.11

ENV NLTK_DATA=${LAMBDA_TASK_ROOT}/nltk_data

# Add requirements to the layer.
COPY requirements.txt ./

# Install Python dependencies.
RUN pip install \
  --no-cache-dir \
  -r requirements.txt

# Download the NLTK data packages.
RUN python -m nltk.downloader \
  --dir ${NLTK_DATA} \
  punkt_tab \
  stopwords

# Copy application files in the container.
COPY . ./

CMD ["main.lambda_handler"]
