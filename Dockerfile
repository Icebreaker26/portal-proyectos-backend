FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 48500

CMD ["sh", "-c", "npm run migrate:up && npm start"]
