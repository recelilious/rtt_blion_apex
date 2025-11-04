# Multi-stage Dockerfile
# Stage 1: build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: build backend (including frontend/dist)
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
# copy built frontend into backend so backend can serve static files
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
RUN npm run build

# Final runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# install only production deps for backend
COPY backend/package*.json ./
RUN npm ci --only=production

# copy built backend and runtime data files
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/backend/data ./backend/data
# copy frontend build so backend can serve static files from process.cwd()/frontend/dist
COPY --from=backend-builder /app/backend/frontend/dist ./frontend/dist

EXPOSE 3000
ENV PORT=3000
CMD ["node", "dist/index.js"]
