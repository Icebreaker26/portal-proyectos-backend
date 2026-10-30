# 0004 — Docker + nginx como mecanismo de despliegue

## Contexto

Kernel/CORE (otro proyecto del mismo autor) despliega en Railway sin Docker: el backend corre con `node src/index.js` y el frontend se sirve como build estático nativo de la plataforma. Para Portal de Proyectos UCP, el poster del curso exige explícitamente una arquitectura de 3 contenedores Docker (frontend/backend/db) con nginx como reverse proxy, porque el destino final es un servidor Linux propio de la Universidad Católica de Pereira, no una PaaS.

## Decisión

Se mantiene Docker + nginx tal como pide el poster: `frontend` (nginx, sirve el build de React y hace proxy inverso a `/api`, único contenedor con puerto publicado), `backend` (Node, stateless, sin puerto publicado), `db` (PostgreSQL, sin puerto publicado), todos en la red interna `portal_net`.

## Consecuencias

- El mismo `docker-compose` sirve para la fase de pruebas en Railway y para el servidor UCP final — "replatforming sin reescribir código", como señala el poster.
- Más complejidad de infraestructura que el enfoque nativo de Kernel/CORE, justificada porque no hay PaaS en el destino final.
- Puertos del host configurados como no genéricos (ver `.env.example` de cada repo) porque la máquina de pruebas ya tiene ocupados los puertos estándar (5432/4000/80/5173).
