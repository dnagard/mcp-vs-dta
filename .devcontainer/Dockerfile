FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Node + pnpm (via corepack), common tools, and netem
ARG NODE_VERSION=20
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
  && apt-get update && apt-get install -y nodejs git iproute2 iputils-ping ca-certificates build-essential \
  && npm i -g pnpm \
  && corepack enable

# Optional: autocannon for quick HTTP benches
RUN npm i -g autocannon
