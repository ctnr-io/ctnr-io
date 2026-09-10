FROM debian:bookworm-slim

ARG CTNR_VERSION
ENV CTNR_VERSION=${CTNR_VERSION}

WORKDIR /workspace

# Install required dependencies for bun and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install bun to /workspace/.bun for non-root user
RUN curl -fsSL https://bun.sh/install | bash && mv /root/.bun /workspace/.bun

# App bundle is built by the build-app job and fetched by the workflow (actions/download-artifact)
# before this build runs, since the GitHub Release asset it used to curl is draft and 404s unauthenticated.
COPY app/dist ./dist

# Copy package.json, npmrc, serve config, and entrypoint
COPY app/package.json app/.npmrc app/serve.json app/docker-entrypoint.sh ./

# Create appuser with UID 1000 and set permissions
RUN useradd -u 1000 -m appuser && chown -R 1000:1000 /workspace
ENV HOME=/workspace

# Install dependencies (for serve)
USER 1000
RUN /workspace/.bun/bin/bun install

EXPOSE 8080

CMD ["sh", "/workspace/docker-entrypoint.sh"]
