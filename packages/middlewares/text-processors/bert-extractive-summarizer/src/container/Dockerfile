FROM huggingface/transformers-pytorch-gpu:4.41.3

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
