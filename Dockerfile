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
# The privacy policy Google Play points at. `main.ts` serves `public/`
# from `__dirname/../public`, and until now the folder was never copied
# in — so the mount resolved to a path that did not exist and every
# request 404'd silently. A privacy-policy URL that 404s is a Play
# rejection, so it has to be here.
#
# One file, not the folder. `public/index.html` and `public/app.js` are
# the local item-generator console; it calls `/items/generate`, which is
# behind `SesionRequeridaGuard` and `CuotaGuard` so an anonymous visitor
# cannot spend anything — but a tool built for one operator's laptop has
# no reason to be reachable from the internet, and `COPY public ./public`
# would publish whatever lands in that folder next.
COPY --chown=node:node public/privacidad.html ./public/privacidad.html
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

# The schema has to exist before the API accepts a request, so migrations
# run first and a failure stops the container rather than serving errors.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
