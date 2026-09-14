FROM public.ecr.aws/lambda/python:3.12

ENV NLTK_DATA=${LAMBDA_TASK_ROOT}/nltk_data

# Copy application files in the container.
COPY . ${LAMBDA_TASK_ROOT}

# Install Python dependencies.
RUN pip install \
  --no-cache-dir \
  -r requirements.txt

# Download the NLTK data packages.
RUN python -m nltk.downloader \
  --dir ${NLTK_DATA} \
  punkt_tab \
  stopwords

CMD ["index.lambda_handler"]
