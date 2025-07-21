#!/bin/bash

# Y-Monitor Production Startup Script
# Este script inicia o projeto Y-Monitor em modo produção

echo "🚀 Iniciando Y-Monitor em modo produção..."
echo "========================================="

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado. Por favor, instale o Node.js 18+ antes de continuar."
    exit 1
fi

# Verificar se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não está instalado. Por favor, instale o npm antes de continuar."
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versão 18 ou superior é necessária. Versão atual: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) encontrado"
echo "✅ npm $(npm --version) encontrado"

# Verificar se existe package.json
if [ ! -f "package.json" ]; then
    echo "❌ package.json não encontrado. Certifique-se de estar no diretório raiz do projeto."
    exit 1
fi

# Verificar se existe turbo.json
if [ ! -f "turbo.json" ]; then
    echo "❌ turbo.json não encontrado. Este projeto requer Turbo."
    exit 1
fi

# Instalar dependências se node_modules não existir
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm ci --only=production
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar dependências."
        exit 1
    fi
    echo "✅ Dependências instaladas com sucesso"
fi

# Verificar se os builds existem
if [ ! -d "apps/web/.next" ] || [ ! -d "apps/api/dist" ]; then
    echo "📦 Compilando projeto..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao compilar projeto."
        exit 1
    fi
    echo "✅ Projeto compilado com sucesso"
fi

# Criar diretório de logs se não existir
mkdir -p apps/api/logs

# Verificar variáveis de ambiente obrigatórias
echo "🔍 Verificando variáveis de ambiente..."

ENV_FILE=""
if [ -f ".env" ]; then
    ENV_FILE=".env"
elif [ -f "apps/api/.env" ]; then
    ENV_FILE="apps/api/.env"
fi

if [ -z "$ENV_FILE" ]; then
    echo "❌ Arquivo .env não encontrado. Configure as variáveis de ambiente antes de continuar."
    echo "   Variáveis obrigatórias:"
    echo "   - DATABASE_URL"
    echo "   - JWT_SECRET"
    echo "   - NODE_ENV=production"
    echo "   - PORT=3006"
    echo "   - CORS_ORIGIN=http://localhost:3005"
    exit 1
fi

# Verificar se DATABASE_URL está configurada
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL não configurada. Configure a conexão com o banco de dados."
    exit 1
fi

# Verificar se JWT_SECRET está configurada
if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET não configurada. Configure uma chave secreta para JWT."
    exit 1
fi

echo "✅ Variáveis de ambiente verificadas"

# Executar migrações do banco de dados
if [ -f "apps/api/prisma/schema.prisma" ]; then
    echo "📊 Executando migrações do banco de dados..."
    cd apps/api
    npx prisma migrate deploy
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao executar migrações do banco de dados."
        exit 1
    fi
    echo "✅ Migrações executadas com sucesso"
    cd ../..
fi

echo ""
echo "🎯 Configuração das portas:"
echo "   - Web: http://localhost:3005"
echo "   - API: http://localhost:3006"
echo "   - Documentação: http://localhost:3006/api"
echo ""

# Função para parar os serviços
stop_services() {
    echo ""
    echo "🛑 Parando serviços..."
    pkill -f "node.*api/dist/main"
    pkill -f "next start"
    exit 0
}

# Capturar Ctrl+C
trap stop_services SIGINT

echo "🚀 Iniciando serviços em modo produção..."
echo "   - Pressione Ctrl+C para parar os serviços"
echo ""

# Iniciar API em background
cd apps/api
NODE_ENV=production npm run start:prod &
API_PID=$!
cd ../..

# Aguardar um pouco para a API iniciar
sleep 3

# Iniciar Web em background
cd apps/web
NODE_ENV=production npm run start &
WEB_PID=$!
cd ..

echo "✅ Serviços iniciados!"
echo "   - API PID: $API_PID"
echo "   - Web PID: $WEB_PID"
echo ""
echo "📱 Acesse a aplicação em: http://localhost:3005"
echo "📚 Documentação da API: http://localhost:3006/api"
echo ""

# Aguardar os processos
wait $API_PID $WEB_PID