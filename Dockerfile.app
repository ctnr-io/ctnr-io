# Stage 1: Build the Expo web app from source
FROM oven/bun:latest AS builder

ARG CTNR_VERSION=""
ARG CTNR_API_URL=https://api.ctnr.io
ARG CTNR_APP_URL=https://app.ctnr.io
ARG SUPABASE_URL=""
ARG SUPABASE_ANON_KEY=""

ENV CTNR_VERSION=${CTNR_VERSION}
ENV CTNR_API_URL=${CTNR_API_URL}
ENV CTNR_APP_URL=${CTNR_APP_URL}
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

WORKDIR /workspace

# Copy lockfile and package.json first for layer caching
COPY app/package.json app/bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the app source and build
COPY app/ .
RUN bunx expo export --platform web

# Stage 2: Serve the built app
FROM debian:bookworm-slim

ARG CTNR_VERSION=""
ENV CTNR_VERSION=${CTNR_VERSION}

WORKDIR /workspace

# Install required dependencies for bun
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install bun to /workspace/.bun for non-root user
RUN curl -fsSL https://bun.sh/install | bash && mv /root/.bun /workspace/.bun

# Copy the built dist from the builder stage
COPY --from=builder /workspace/dist ./dist

# Copy package.json and .npmrc for serve dependency
COPY app/package.json app/.npmrc ./

# Create appuser with UID 1000 and set permissions
RUN useradd -u 1000 -m appuser && chown -R 1000:1000 /workspace
ENV HOME=/workspace

# Install dependencies (for serve)
USER 1000
RUN /workspace/.bun/bin/bun install

EXPOSE 8080

CMD ["/workspace/.bun/bin/bun", "x", "serve", "dist", "-l", "8080"]
