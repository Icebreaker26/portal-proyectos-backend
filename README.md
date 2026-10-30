# Portal de Proyectos UCP — Backend

API REST (Node + Express ESM + PostgreSQL) del Portal de Proyectos de la Universidad Católica de Pereira.
Proyecto final de Cloud Computing — Alejandro Marín, Martin Salazar, Alejandro Jaramillo.

Arquitectura y convenciones de código: mismo método que Kernel/CORE (núcleo transversal + módulos enchufables),
sin multi-tenant y con el núcleo de seguridad reducido al alcance de este proyecto.

## Stack

PostgreSQL · Express (ESM) · Node.js · Docker

## Puertos (no genéricos — la máquina de pruebas ya tiene ocupados los estándar)

| Servicio | Puerto host | Puerto interno |
|---|---|---|
| backend | `48500` | `48500` |
| db (Postgres) | `54329` | `5432` |

## Levantar en local

```bash
cp .env.example .env
docker-compose up -d db
npm install
npm run migrate:up
npm run dev
```

`GET http://localhost:48500/api/proyectos/pub` debe responder sin autenticación.

## Flujo de trabajo (Git flow)

- `main`: estable / releases.
- `develop`: integración — rama por defecto para PRs.
- `feature/<nombre>`: una por cada issue, contra `develop`.
- Commits: Conventional Commits simple (`feat:`, `fix:`, `chore:`, `docs:`).
- Sin protección de rama por ahora.

## Documentación de ingeniería

Ver [`docs/`](docs/) para SRS, SDD, plan de pruebas y ADRs (decisiones de arquitectura), y la [Wiki](../../wiki) del repo para notas vivas de estado/despliegue.
