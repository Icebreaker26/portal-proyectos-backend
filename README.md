# Portal de Proyectos UCP — Backend

[![CI](https://github.com/Icebreaker26/portal-proyectos-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Icebreaker26/portal-proyectos-backend/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-ESM-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-desplegado-0B0D0E?logo=railway&logoColor=white)

API REST (Node + Express ESM + PostgreSQL) del Portal de Proyectos de la Universidad Católica de
Pereira. Proyecto final de Cloud Computing — Alejandro Marín, Martín Salazar, Alejandro Jaramillo.

Arquitectura y convenciones de código: mismo método que Kernel/CORE (núcleo transversal + módulos
enchufables), sin multi-tenant y con el núcleo de seguridad reducido al alcance de este proyecto.

## En vivo

| | |
|---|---|
| Frontend | https://frontend-production-bf16ffea.up.railway.app |
| API (este repo) | https://backend-production-76fde702.up.railway.app/api |
| Repo frontend | [`portal-proyectos-frontend`](https://github.com/Icebreaker26/portal-proyectos-frontend) |

Desplegado en [Railway](https://railway.app) (fase de pruebas): servicio Postgres administrado +
este backend, ambos con auto-deploy desde `main` vía GitHub Actions/CI propio (ver abajo) y volúmenes
persistentes para la base de datos y los archivos subidos.

## Stack

PostgreSQL · Express (ESM) · Node.js · Docker

## Arquitectura (resumen)

- **Núcleo transversal**: auth JWT (cookie HttpOnly), permisos granulares por módulo+acción
  (`checkPermission`), logging con Winston, manejo de errores centralizado.
- **Módulos de negocio enchufables**: `proyectos` (modelo extendido: programa/asignatura/
  participantes/consentimiento/revisiones/archivos) y `votos`. Cada módulo se autodescubre por
  convención de carpetas (`src/modules/<nombre>/routes/<nombre>Routes.js`).
- **PKs UUID** y **borrado lógico** (`is_active`) en toda entidad de negocio — nunca `DELETE`
  físico.
- Detalle completo de requisitos, diseño y decisiones de arquitectura en [`docs/`](docs/)
  (SRS, SDD, plan de pruebas, 10 ADRs).

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

## Datos de prueba

```bash
npm run seed:demo
```

Crea (idempotente, se puede correr varias veces) usuarios y proyectos reales con votos
distribuidos, para probar el portal manualmente sin armar los datos a mano. Contraseña de
**todas** las cuentas: `Demo1234!`.

| Email | Rol |
|---|---|
| `admin@ucp.edu.co` | admin |
| `profesor1@ucp.edu.co`, `profesor2@ucp.edu.co` | profesor |
| `estudiante1@ucp.edu.co` … `estudiante4@ucp.edu.co` | estudiante |

No usar contra una base de producción real (sí se usó contra el entorno de pruebas de Railway,
que es justamente para esto). Para sembrar solo un admin (sin datos de prueba), usar
`npm run seed <email> <password> <nombre>` (`scripts/seed.js`).

## Pruebas

```bash
npm test
```

Suite de integración (Jest + Supertest) contra una instancia real de PostgreSQL — nunca mocks de
base de datos. Corre automáticamente en cada push/PR a `develop` y `main` vía
[GitHub Actions](.github/workflows/ci.yml).

## Flujo de trabajo (Git flow)

- `main`: estable / releases.
- `develop`: integración — rama por defecto para PRs.
- `feature/<nombre>` / `fix/<nombre>`: una por cada issue o corrección, contra `develop`.
- Commits: Conventional Commits simple (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`).
- Sin protección de rama por ahora.

## Documentación de ingeniería

Ver [`docs/`](docs/) para SRS, SDD, plan de pruebas y ADRs (decisiones de arquitectura), y la
[Wiki](../../wiki) del repo para notas vivas de estado/despliegue.

## Para un agente/colaborador nuevo

Antes de tocar código, lee [`AGENTS.md`](AGENTS.md) (convenciones de este repo, autocontenido — no
depende de ningún otro proyecto) y los
[issues abiertos del milestone Fase 1](https://github.com/Icebreaker26/portal-proyectos-backend/milestones)
para ver qué falta. El scaffolding base (núcleo, auth, módulos `proyectos`/`votos`, migraciones,
Docker, CI) ya existe; cada issue indica en un comentario qué parte está hecha y qué falta.
