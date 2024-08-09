FROM public.ecr.aws/lambda/python:3.11

# Image arguments.
ARG PANDOC_VERSION=3.3

# Install dependencies and clean up in one layer
RUN yum update -y && \
  yum install -y \
      wget \
      tar \
      gzip \
      poppler-utils \
      python-poppler \
      gcc && \
  yum clean all && \
  rm -rf /var/cache/yum

# Install Pandoc.
RUN wget https://github.com/jgm/pandoc/releases/download/"${PANDOC_VERSION}"/pandoc-"${PANDOC_VERSION}"-linux-amd64.tar.gz && \
    tar xvzf pandoc-"${PANDOC_VERSION}"-linux-amd64.tar.gz && \
    cp pandoc-"${PANDOC_VERSION}"/bin/pandoc /usr/local/bin && \
    rm -rf pandoc-"${PANDOC_VERSION}"*

# Add requirements to the layer.
COPY requirements.txt ./

# Upgrade pip and install Python dependencies in one layer
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application files in the container.
COPY . ./

CMD ["main.lambda_handler"]
