#!/usr/bin/env bash

# Start the ollama server.
ollama serve &

# Start the application.
python3 /home/docker-user/app/main.py
