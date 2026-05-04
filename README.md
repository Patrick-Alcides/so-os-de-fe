# Só os de Fé

Sistema web para gerenciamento do grupo Só os de Fé com:

- Backend em FastAPI
- Frontend em React + Vite + Tailwind
- Banco PostgreSQL via `DATABASE_URL`
- Login com `telefone + senha`
- Perfis `administrador` e `jogador`

## Estrutura

```text
backend/
  app/
  requirements.txt
  .env.example

frontend/
  src/
  .env.example
  vercel.json

render.yaml
```

## Requisitos locais

- Python 3.11+
- Node.js 20+
- npm 10+

## Variaveis de ambiente

### Backend

Crie `backend/.env` com base em `backend/.env.example`:

```env
DATABASE_URL=postgresql://postgres:senha@db.xxxxx.supabase.co:5432/postgres?sslmode=require
SECRET_KEY=troque-por-uma-chave-forte
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### Frontend

Crie `frontend/.env` com base em [frontend/.env.example](C:/Users/PATRICK/Documents/codex/frontend/.env.example):

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

## Como rodar localmente

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API:

- `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

- `http://127.0.0.1:5173`

## Banco de dados

O projeto agora funciona com `DATABASE_URL`.

- Em desenvolvimento, voce pode continuar usando SQLite se quiser:

```env
DATABASE_URL=sqlite:///./futsal.db
```

- Em producao, use PostgreSQL do Supabase:

```env
DATABASE_URL=postgresql://postgres:senha@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

O backend converte automaticamente URLs `postgres://` e `postgresql://` para o driver SQLAlchemy compatível.

## Deploy no Supabase

1. Crie um projeto no Supabase.
2. Copie a connection string PostgreSQL.
3. Adicione `?sslmode=require` no final, se ainda nao vier assim.
4. Use essa URL na variavel `DATABASE_URL` do Render.

## Deploy do backend no Render

O projeto ja inclui `render.yaml`.

### Opcao 1: Blueprint

1. Suba o repositório no GitHub.
2. No Render, escolha `New +` -> `Blueprint`.
3. Selecione o repositório.
4. Preencha as variaveis:
   - `DATABASE_URL`
   - `SECRET_KEY`
   - `FRONTEND_URL`
   - `CORS_ORIGINS`

### Opcao 2: Web Service manual

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Variaveis recomendadas no Render

```env
DATABASE_URL=postgresql://postgres:senha@db.xxxxx.supabase.co:5432/postgres?sslmode=require
SECRET_KEY=gere-uma-chave-forte
FRONTEND_URL=https://seu-projeto.vercel.app
CORS_ORIGINS=https://seu-projeto.vercel.app,http://localhost:5173,http://127.0.0.1:5173
```

## Deploy do frontend na Vercel

O projeto ja inclui `frontend/vercel.json` para manter as rotas do React funcionando em refresh direto.

1. Importe o repositório na Vercel.
2. Configure o projeto apontando para a pasta `frontend`.
3. Adicione a variavel:

```env
VITE_API_URL=https://seu-backend.onrender.com/api
```

4. Faça o deploy.

Depois, pegue a URL gerada pela Vercel e coloque no Render em:

- `FRONTEND_URL`
- `CORS_ORIGINS`

## Login padrao

Administrador:

- Telefone: `(51) 99999-1001`
- Senha: `admin123`

Jogadores de exemplo:

- Telefones de alguns jogadores de exemplo ja possuem acesso
- Senha padrao dos jogadores seed: `123456`

## Fotos dos jogadores

Para deploy gratuito, o sistema nao salva mais upload em disco local.

Agora a foto do jogador funciona assim:

- campo opcional por `URL da imagem`
- pode usar imagem hospedada externamente
- se nao informar, o sistema usa avatar placeholder

## Seed inicial

Na primeira inicializacao, o sistema cria automaticamente:

- configuracao do grupo
- jogadores de exemplo
- pagamentos de exemplo
- votacoes de exemplo
- usuario administrador
- usuarios jogadores de exemplo

## Observacoes

- O valor em caixa continua visivel para todos, mas editavel so pelo administrador.
- O backend cria as tabelas automaticamente no banco configurado em `DATABASE_URL`.
- Para producao, troque sempre a `SECRET_KEY`.
