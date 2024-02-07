FROM pytorch/pytorch:1.13.1-cuda11.6-cudnn8-runtime

# Install dependencies.
RUN export DEBIAN_FRONTEND=noninteractive \
  && apt-get -y update \
  && apt-get -y install --no-install-recommends \
    git

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

ENTRYPOINT ["python3", "app/main.py"]
