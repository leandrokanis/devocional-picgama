FROM node:22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY package.json yarn.lock turbo.json ./
COPY apps/ui/package.json ./apps/ui/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN yarn install --frozen-lockfile

COPY . .

ARG VITE_AUTH_TOKEN
ENV VITE_AUTH_TOKEN=$VITE_AUTH_TOKEN

RUN yarn workspace @devocional/ui build

FROM nginx:1.27-alpine

COPY apps/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/ui/dist /usr/share/nginx/html

EXPOSE 80
