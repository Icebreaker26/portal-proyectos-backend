FROM node:20-alpine

WORKDIR /app

# su-exec: para bajar de root a "node" en el entrypoint después de corregir el dueño del volumen
# de uploads (ver docker-entrypoint.sh) — alpine no lo trae por defecto.
RUN apk add --no-cache su-exec

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# node:20-alpine ya trae el usuario no-root "node" (uid 1000) — evitamos correr como root.
# El contenedor arranca como root (sin USER aquí) solo para que el entrypoint pueda chown-ear
# uploads/ en runtime (es un volumen montado, llega vacío y dueño de root — ver el comentario en
# docker-entrypoint.sh); ese script baja a "node" con su-exec antes de ejecutar el CMD real.
RUN mkdir -p uploads && chown -R node:node /app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 48500

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "npm run migrate:up && npm start"]
