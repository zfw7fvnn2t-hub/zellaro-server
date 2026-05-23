# Zellaro Intelligence Server

Servidor para gerar copy de produtos e minerar produtos vencedores no AliExpress.

## 🚀 Deploy no Railway (3 passos)

### Passo 1 — Criar conta no GitHub
1. Acesse https://github.com e crie uma conta gratuita
2. Crie um repositório novo chamado `zellaro-server`
3. Faça upload de todos os arquivos desta pasta

### Passo 2 — Deploy no Railway
1. Acesse https://railway.app
2. Clique em "Start a New Project"
3. Escolha "Deploy from GitHub repo"
4. Selecione o repositório `zellaro-server`
5. Railway vai detectar automaticamente que é Node.js

### Passo 3 — Configurar API Key
1. No Railway, vá em "Variables"
2. Adicione a variável:
   - Key: `ANTHROPIC_API_KEY`
   - Value: sua API key (https://console.anthropic.com)
3. Clique em Deploy

### Pronto! 🎉
O Railway vai te dar uma URL tipo: `https://zellaro-server-production.up.railway.app`
Acesse essa URL no browser para usar o app.

## 🔑 Onde pegar a API Key do Claude
1. Acesse https://console.anthropic.com
2. Crie uma conta
3. Vá em "API Keys" → "Create Key"
4. Copie a key e coloque no Railway

## 💰 Custo
- Railway: grátis ($5 crédito/mês, suficiente para uso pessoal)
- API Claude: ~$0.01-0.05 por geração (muito barato)

## 🛠 Rodar localmente (opcional)
```bash
npm install
cp .env.example .env
# edite .env e coloque sua API key
node server.js
```
Acesse: http://localhost:3000
