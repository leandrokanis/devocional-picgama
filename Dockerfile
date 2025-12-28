FROM oven/bun:1

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and build
COPY . .
RUN rm -rf dist && bun run build

# Create tokens directory with proper permissions
# Using /tmp ensures we have write access in most environments
RUN mkdir -p /tmp/tokens && \
    chmod -R 777 /tmp/tokens

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
