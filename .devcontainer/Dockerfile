FROM mcr.microsoft.com/devcontainers/javascript-node:20

# This section to install additional OS packages.
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends bash-completion
