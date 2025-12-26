FROM ghcr.io/puppeteer/puppeteer:21.6.1

# Install Bun globally
USER root
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN /root/.bun/bin/bun install --frozen-lockfile

# Copy source code and build
COPY . .
RUN rm -rf dist && /root/.bun/bin/bun run build

# Create tokens directory with proper permissions
RUN mkdir -p /tmp/tokens && \
    chmod -R 755 /tmp/tokens

# Expose port
EXPOSE 3000

# Stay as root to avoid permission issues
USER root

# Start the application with Bun
CMD ["/root/.bun/bin/bun", "run", "start"]
