FROM node:22-alpine

RUN apk add --no-cache git wget

WORKDIR /app

COPY package.json yarn.lock turbo.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn workspace @devocional/api prisma generate
RUN yarn workspace @devocional/api build

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && yarn start"]
