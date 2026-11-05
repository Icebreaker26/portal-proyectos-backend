FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# node:20-alpine ya trae el usuario no-root "node" (uid 1000) — evitamos correr como root
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 48500

CMD ["sh", "-c", "npm run migrate:up && npm start"]
