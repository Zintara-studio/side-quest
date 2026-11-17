# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /build

# Install deps first (only re-runs when the lockfile changes).
COPY package.json package-lock.json* ./
RUN npm ci

# The public config is BAKED IN at build time (NEXT_PUBLIC_* is inlined into the client bundle), so it
# must be supplied as build args — a runtime env var would be too late. NEXT_PUBLIC_API_URL points at the
# browser-reachable API (e.g. https://your-host/v1); NEXT_PUBLIC_GOOGLE_CLIENT_ID enables the Google
# button (leave empty to hide it).
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

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
