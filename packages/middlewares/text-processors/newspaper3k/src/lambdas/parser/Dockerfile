FROM public.ecr.aws/lambda/python:3.11

# Copy application files in the container.
COPY . ${LAMBDA_TASK_ROOT}

# Install Python dependencies.
RUN pip install \
  --no-cache-dir \
  -r requirements.txt

CMD ["index.lambda_handler"]
