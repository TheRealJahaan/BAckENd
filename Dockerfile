# syntax=docker/dockerfile:1

# ---- build: install all deps and compile TypeScript ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime: only compiled JS and production deps, running as non-root ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_PATH=/data/app.db
WORKDIR /app

RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node
VOLUME ["/data"]
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" > /dev/null || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server.js"]
