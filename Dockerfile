FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm","start"]
