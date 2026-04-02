FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:20-alpine AS backend-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app/server
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY --from=backend-deps /app/server/node_modules ./node_modules
COPY server ./
COPY --from=frontend-build /app/build ../build

EXPOSE 3001
CMD ["node", "server.js"]
