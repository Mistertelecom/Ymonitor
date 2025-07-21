#!/bin/bash

# Y-Monitor Development Startup Script
# Este script inicia o projeto Y-Monitor em modo desenvolvimento

echo "🚀 Iniciando Y-Monitor em modo desenvolvimento..."
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

# Instalar dependências se node_modules não existir
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar dependências."
        exit 1
    fi
    echo "✅ Dependências instaladas com sucesso"
fi

# Verificar se existe turbo.json
if [ ! -f "turbo.json" ]; then
    echo "❌ turbo.json não encontrado. Este projeto requer Turbo."
    exit 1
fi

# Criar diretório de logs se não existir
mkdir -p apps/api/logs

# Verificar se os arquivos de configuração existem
if [ ! -f "apps/api/prisma/schema.prisma" ]; then
    echo "⚠️  Arquivo prisma/schema.prisma não encontrado. Certifique-se de configurar o banco de dados."
fi

# Verificar se existe arquivo .env
if [ ! -f ".env" ] && [ ! -f "apps/api/.env" ]; then
    echo "⚠️  Arquivo .env não encontrado. Certifique-se de configurar as variáveis de ambiente."
    echo "   Exemplo de variáveis necessárias:"
    echo "   - DATABASE_URL"
    echo "   - JWT_SECRET"
    echo "   - PORT=3006"
    echo "   - CORS_ORIGIN=http://localhost:3005"
fi

echo ""
echo "🎯 Configuração das portas:"
echo "   - Web: http://localhost:3005"
echo "   - API: http://localhost:3006"
echo "   - Documentação: http://localhost:3006/api"
echo ""

# Perguntar se deseja iniciar os serviços
echo "Deseja iniciar os serviços agora? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "🚀 Iniciando serviços..."
    echo "   - Pressione Ctrl+C para parar os serviços"
    echo "   - Os logs serão exibidos abaixo"
    echo ""
    
    # Iniciar em modo desenvolvimento usando turbo
    npm run dev
else
    echo "📝 Para iniciar os serviços manualmente, execute:"
    echo "   npm run dev"
    echo ""
    echo "📚 Outros comandos úteis:"
    echo "   npm run build       # Compilar projeto"
    echo "   npm run test        # Executar testes"
    echo "   npm run lint        # Verificar código"
    echo "   npm run docker:dev  # Iniciar com Docker"
fi

echo ""
echo "✅ Script concluído!"