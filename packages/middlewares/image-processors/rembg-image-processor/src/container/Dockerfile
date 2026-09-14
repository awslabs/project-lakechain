FROM nvidia/cuda:13.0.1-cudnn-devel-ubuntu24.04

ENV PYTHON_VERSION=3.12
ENV PYTHONPATH /code/app
ENV PYTHONUNBUFFERED 1

# Install dependencies.
RUN export DEBIAN_FRONTEND=noninteractive \
  && apt-get -y update \
  && apt-get -y install --no-install-recommends \
    python${PYTHON_VERSION} \
    python3-pip \
    python3-venv \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Copy Python binaries.
RUN ln -s -f /usr/bin/python${PYTHON_VERSION} /usr/bin/python3 && \
    ln -s -f /usr/bin/python${PYTHON_VERSION} /usr/bin/python && \
    ln -s -f /usr/bin/pip3 /usr/bin/pip

# Create a new user for running the application.
RUN groupmod --new-name docker-user ubuntu \
  && usermod --login docker-user --home /home/docker-user --move-home ubuntu

# Switch to the docker user.
USER docker-user
WORKDIR /home/docker-user

# Create an isolated Python environment.
ENV VIRTUAL_ENV="/home/docker-user/.venv"
RUN python3 -m venv "${VIRTUAL_ENV}"
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

# Install Python dependencies.
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

# Copy application files.
COPY ./app /home/docker-user/app

ENTRYPOINT ["python3", "app/main.py"]
