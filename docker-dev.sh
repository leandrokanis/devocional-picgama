#!/bin/bash

# Docker Development Script
# Este script configura e executa a aplicação em modo desenvolvimento com hot reload

set -e

echo "🚀 Iniciando Devocional Bot em modo desenvolvimento..."

# Verificar se o arquivo .env existe
if [ ! -f ".env" ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "💡 Copie o arquivo docker-dev.env.example para .env e configure as variáveis:"
    echo "   cp docker-dev.env.example .env"
    exit 1
fi

# Verificar se NODE_ENV está definido como development no .env
if ! grep -q "NODE_ENV=development" .env; then
    echo "⚠️  Adicionando NODE_ENV=development ao arquivo .env..."
    echo "NODE_ENV=development" >> .env
fi

# Verificar se DOCKERFILE está definido no .env
if ! grep -q "DOCKERFILE=Dockerfile.dev" .env; then
    echo "⚠️  Adicionando DOCKERFILE=Dockerfile.dev ao arquivo .env..."
    echo "DOCKERFILE=Dockerfile.dev" >> .env
fi

echo "📦 Construindo imagem de desenvolvimento..."
docker compose build

echo "🔄 Iniciando container em modo desenvolvimento com hot reload..."
docker compose up

echo "✅ Aplicação iniciada em modo desenvolvimento!"
echo "🌐 Acesse: http://localhost:3000"
echo "📱 QR Code: http://localhost:3000/qr"
echo "🔄 Hot reload ativo - modifique os arquivos em src/ para ver as mudanças"
