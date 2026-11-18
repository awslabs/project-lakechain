# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:0.13.8 AS uv
FROM ollama/ollama:0.3.6

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH=/code/app \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Keep Ollama's system libraries and run the worker with its own Python.
COPY requirements.txt /tmp/requirements.txt
RUN --mount=from=uv,source=/uv,target=/usr/local/bin/uv \
    umask 022 \
    && UV_PYTHON_INSTALL_DIR=/opt/python uv venv --no-cache --managed-python --python 3.12.16 /opt/venv \
    && uv pip install --no-cache --python /opt/venv/bin/python -r /tmp/requirements.txt \
    && uv pip check --python /opt/venv/bin/python

ARG UID=1000
RUN adduser --uid ${UID} --disabled-password docker-user

USER docker-user
RUN python3 -c "from filelock import FileLock"
WORKDIR /home/docker-user
COPY ./app ./app
COPY start.sh ./start.sh
ENTRYPOINT [ "/bin/bash", "start.sh" ]
