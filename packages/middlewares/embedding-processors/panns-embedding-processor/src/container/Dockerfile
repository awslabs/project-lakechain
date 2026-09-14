FROM pytorch/pytorch:2.14.0-cuda12.6-cudnn9-runtime

# Install dependencies.
RUN export DEBIAN_FRONTEND=noninteractive \
  && apt-get -y update \
  && apt-get -y install --no-install-recommends \
    wget \
    python3-venv \
    ffmpeg

# Create a new user for running the application.
RUN groupmod --new-name docker-user ubuntu \
  && usermod --login docker-user --home /home/docker-user --move-home ubuntu

# Switch to the docker user.
USER docker-user
WORKDIR /home/docker-user

# Create an isolated Python environment while reusing the base Torch installation.
ENV VIRTUAL_ENV="/home/docker-user/.venv"
RUN python3 -m venv --system-site-packages "${VIRTUAL_ENV}"
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

# Install Python dependencies.
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

# Copy application files.
COPY ./app /home/docker-user/app

ENTRYPOINT ["python3", "app/main.py"]
