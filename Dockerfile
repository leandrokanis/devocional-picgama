FROM node:22-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN rm -rf dist && npx tsc -p tsconfig.build.json && \
    cp src/swagger.json dist/swagger.json 2>/dev/null || true && \
    cp -r data dist/ 2>/dev/null || true

RUN mkdir -p /tmp/tokens && chmod -R 777 /tmp/tokens

EXPOSE 4000

CMD ["node", "dist/index.js"]
