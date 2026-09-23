FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM node:24-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV HF_CACHE_DIR=/app/.cache/huggingface

RUN mkdir -p /app/.cache/huggingface

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 5002

CMD ["node", "dist/server.js"]