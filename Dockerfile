# Base image ships Chromium + all OS libs Playwright needs.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# Copy manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/test-engine/package.json packages/test-engine/
COPY tests/demo-app/package.json tests/demo-app/

# Install everything (need devDeps for tsc build).
RUN npm install --include=dev

# Copy source.
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

# Build API + its workspace deps.
RUN npm run build --workspace @ai-bug-hunter/shared \
 && npm run build --workspace @ai-bug-hunter/test-engine \
 && npm run build --workspace @ai-bug-hunter/api

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "apps/api/dist/index.js"]
