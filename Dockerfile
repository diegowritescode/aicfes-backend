# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
# Prisma's engines link against OpenSSL, which alpine does not ship.
RUN apk add --no-cache openssl
WORKDIR /app

# --- deps: install from the lockfile, manifests only so the layer caches ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- build: compile the API and generate the Prisma client ---
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# --- prod-deps: the runtime dependency tree on its own ---
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# --- runtime: the compiled API, its production dependencies and the migrations ---
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prompts ./prompts
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

# The schema has to exist before the API accepts a request, so migrations
# run first and a failure stops the container rather than serving errors.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
