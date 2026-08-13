FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=21590
RUN apk add --no-cache su-exec
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts/docker-entrypoint.sh /usr/local/bin/yacsrcon-entrypoint
RUN chmod 0755 /usr/local/bin/yacsrcon-entrypoint
EXPOSE 21590
ENTRYPOINT ["/usr/local/bin/yacsrcon-entrypoint"]
CMD ["node", "server.js"]
