#!/usr/bin/env bash

#  Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Start the ollama server.
ollama serve &

# Waits for the Ollama server to be up and running.
wait_for_server() {
  local retries=5
  local wait=5
  local url=http://127.0.0.1:11434

  until $(curl --output /dev/null --silent --head --fail "$url"); do
    if [ $retries -eq 0 ]; then
      echo "Ollama server failed to start."
      exit 1
    fi

    retries=$((retries - 1))
    sleep $wait
  done
}

# Wait for the server to start.
wait_for_server

# Start the application.
python3 /home/docker-user/app/main.py
