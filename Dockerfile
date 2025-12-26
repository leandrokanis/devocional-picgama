FROM oven/bun:1.2.20-alpine

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

EXPOSE 3000

USER bun
CMD ["bun", "run", "start"]
