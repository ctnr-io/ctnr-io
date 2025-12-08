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

# Download and extract the app from the GitHub release
RUN curl -fsSL https://github.com/ctnr-io/ctnr-io/releases/download/${CTNR_VERSION}/ctnr-app-${CTNR_VERSION}.tar.gz -o ctnr-app.tar.gz && \
    tar -xzf ctnr-app.tar.gz && \
    rm ctnr-app.tar.gz

# Copy package.json for serve dependency
COPY app/package.json app/.npmrc ./

# Create appuser with UID 1000 and set permissions
RUN useradd -u 1000 -m appuser && chown -R 1000:1000 /workspace

# Install dependencies (for serve)
USER 1000
RUN /workspace/.bun/bin/bun install

EXPOSE 8080

CMD ["/workspace/.bun/bin/bun", "x", "serve", "dist", "-l", "8080"]
