# ---- Build stage ----
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Force nitro to output a plain Node server instead of the
# Cloudflare Workers bundle that this template defaults to.
ENV NITRO_PRESET=node-server
RUN bun run build

# ---- Runtime stage ----
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Coolify injects PORT automatically; 3000 is just the fallback.
ENV PORT=3000

COPY --from=builder /app/.output ./.output

EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]
