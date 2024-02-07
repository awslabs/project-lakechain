FROM huggingface/transformers-pytorch-gpu:4.35.2

# Install dependencies.
RUN export DEBIAN_FRONTEND=noninteractive \
  && apt-get -y update \
  && apt-get -y install --no-install-recommends \
    git \
    python3.8-venv \
    ffmpeg \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Create a new user for running the application.
ARG UID=1000
RUN adduser --uid ${UID} --disabled-password docker-user
RUN chown -R docker-user:docker-user /opt/

# Switch to the docker user.
USER docker-user
WORKDIR /home/docker-user

# Create a virtual environment.
RUN python3 -m venv /opt/venv 

# Install Python dependencies.
COPY requirements.txt requirements.txt
RUN . /opt/venv/bin/activate && pip3 install --no-cache-dir -r requirements.txt

# Copy application files.
COPY ./app /home/docker-user/app

CMD . /opt/venv/bin/activate && exec python3 app/main.py
