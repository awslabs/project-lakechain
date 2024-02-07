FROM public.ecr.aws/lambda/python:3.11

# Add requirements to the layer.
COPY requirements.txt ./

# Install Python dependencies.
RUN pip install \
  --no-cache-dir \
  -r requirements.txt

# Copy application files in the container.
COPY . ./

CMD ["main.lambda_handler"]
