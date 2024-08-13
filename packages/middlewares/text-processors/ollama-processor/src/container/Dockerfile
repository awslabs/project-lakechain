FROM ollama/ollama:0.3.6

ENV PYTHON_VERSION=3.10
ENV PYTHONPATH /code/app
ENV PYTHONUNBUFFERED 1

# Install dependencies.
RUN export DEBIAN_FRONTEND=noninteractive \
  && apt-get -y update \
  && apt-get -y install --no-install-recommends \
    python${PYTHON_VERSION} \
    python3-pip \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Copy Python binaries.
RUN ln -s -f /usr/bin/python${PYTHON_VERSION} /usr/bin/python3 && \
    ln -s -f /usr/bin/python${PYTHON_VERSION} /usr/bin/python && \
    ln -s -f /usr/bin/pip3 /usr/bin/pip

# Create a new user for running the application.
ARG UID=1000
RUN adduser --uid ${UID} --disabled-password docker-user

# Switch to the docker user.
USER docker-user
WORKDIR /home/docker-user

# Install Python dependencies.
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

# Copy application files.
COPY ./app /home/docker-user/app

COPY start.sh /start.sh
ENTRYPOINT [ "/bin/bash", "/start.sh" ]
