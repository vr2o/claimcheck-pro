# QikVerify.com (ClaimCheck Pro) — Multilingual Evidence Platform

Aggregates multilingual evidence and quality signals (EQS, SDI, stance & transparency). **No truth verdicts.**

## Quickstart (Dev)
```bash
pnpm install
cp .env.example .env.local
# edit .env.local:
#   PRISMA_DB_PROVIDER=sqlite
#   DATABASE_URL="file:./dev.db"
#   TAVILY_API_KEY=...
#   SEARCH_PROVIDERS=tavily
pnpm prisma:gen
pnpm prisma:migrate
pnpm dev
# second terminal:
pnpm build:workers
pnpm start:worker
```
