#!/bin/sh
set -e

# En Railway (y en docker-compose local) uploads/ es un volumen montado en runtime, no la carpeta
# de la imagen: el volumen llega vacío y dueño de root, aunque el Dockerfile ya haya hecho
# chown de /app a node:node en build time (eso queda tapado por el mount). Sin este ajuste el
# proceso, que corre como "node" (ver USER más abajo... ya no: ahora se baja de privilegio aquí
# mismo), no puede escribir ningún archivo subido — EACCES silencioso.
chown -R node:node /app/uploads

exec su-exec node "$@"
