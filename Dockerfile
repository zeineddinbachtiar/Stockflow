
# --------------------------------------------------
# Stage 1: Install all dependencies
# --------------------------------------------------
FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


# --------------------------------------------------
# Stage 2: Build TypeScript application
# --------------------------------------------------
FROM dependencies AS build

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


# --------------------------------------------------
# Stage 3: Keep production dependencies only
# --------------------------------------------------
FROM dependencies AS production-dependencies

RUN npm prune --omit=dev


# --------------------------------------------------
# Stage 4: Production runtime
# --------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=production-dependencies --chown=node:node \
  /app/node_modules ./node_modules

COPY --from=build --chown=node:node \
  /app/dist ./dist

COPY --chown=node:node package.json ./package.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/ready').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
