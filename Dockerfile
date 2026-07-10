# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /build

# Install deps first (only re-runs when the lockfile changes).
COPY package.json package-lock.json* ./
RUN npm ci

# The API origin is BAKED IN at build time (NEXT_PUBLIC_* is inlined into the client bundle), so it must
# be supplied as a build arg — a runtime env var would be too late. Point it at the browser-reachable
# API URL for the target environment (e.g. https://api.your-domain.com/v1).
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
# `next build` + the postbuild hook produce a self-contained .next/standalone (server.js + static + public).
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone output already bundles public/ and .next/static/ (via the postbuild hook).
COPY --from=build /build/.next/standalone ./
COPY --from=build /build/.next/static ./.next/static
COPY --from=build /build/public ./public

EXPOSE 3000
USER node
CMD ["node", "server.js"]
