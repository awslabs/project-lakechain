FROM public.ecr.aws/lambda/python:3.10

# Add requirements to the layer.
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install Python dependencies.
RUN pip install \
  --no-cache-dir \
  -r requirements.txt

# Copy application files in the container.
COPY . ./

CMD ["index.lambda_handler"]