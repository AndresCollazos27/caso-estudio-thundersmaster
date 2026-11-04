# Etapa 1: compila el cliente (Vite) y el servidor (TypeScript).
FROM node:22-alpine AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.server.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# Etapa 2: solo lo necesario para correr.
FROM node:22-alpine
# tzdata, para que la variable TZ funcione en el nombre de las exportaciones.
RUN apk add --no-cache tzdata
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=compilar /app/dist ./dist
COPY content ./content
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 8090
CMD ["node", "dist/node/server/index.js"]
