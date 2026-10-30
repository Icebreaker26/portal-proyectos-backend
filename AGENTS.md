# AGENTS.md — Backend Portal de Proyectos UCP

Convenciones de este repo para cualquier agente o colaborador nuevo. Este archivo es autocontenido:
no asume acceso a ningún otro proyecto, skill o configuración externa. Si algo aquí entra en
conflicto con lo que observas en el código, el código manda — abre un issue señalando la diferencia.

## Qué es este proyecto

API REST del Portal de Proyectos UCP (ver [`docs/01-requisitos/SRS.md`](docs/01-requisitos/SRS.md)
para el alcance completo). Monolito modular: un núcleo transversal (auth, permisos, logging) +
módulos de negocio enchufables (`proyectos`, `votos`) que se autodescubren por convención de carpetas.

## Estado actual (ver también los issues del milestone "Fase 1")

El scaffolding base **ya existe** en `develop`:
- Núcleo: `src/config/env.js`, `src/db/database.js`, `src/middlewares/*`, `src/createApp.js`, `src/index.js`.
- Módulo `auth`: login/logout/me funcionando contra `global_usuarios`.
- Módulos `proyectos` y `votos`: CRUD básico, falta completar reglas de negocio y tests.
- Migraciones 0001–0004 (init, permisos, proyectos, votos).
- `Dockerfile` + `docker-compose.yml`.
- `docs/` con esqueleto SWEBOK (SRS/SDD/plan de pruebas) y 5 ADRs ya completados.

**No se ha corrido** `npm install` ni `docker-compose up` contra una base de datos real todavía —
nadie ha verificado que el stack completo levante de punta a punta. Verifícalo antes de asumir que
algo "ya funciona" solo porque el archivo existe.

Cada issue abierto trae un comentario indicando qué parte de su alcance está hecha y qué falta.
Lee el issue completo (incluyendo comentarios) antes de empezar a trabajar en él.

## Reglas críticas (no romper)

1. **PKs UUID** (`uuid_generate_v4()`), nunca enteros autoincrementales en tablas de negocio.
2. **Borrado lógico** (`is_active = false`); nunca `DELETE` físico en `proyectos`, `votos`, `global_usuarios`.
3. **Toda ruta privada lleva `checkPermission(modulo, accion)`**, sin excepción. Las públicas van bajo
   `/api/<modulo>/pub/...` con su propio rate limiter, montadas ANTES de `router.use(verifyToken)`.
4. **Variables de entorno nuevas → agregar al schema Zod en `src/config/env.js`**; el proceso debe
   abortar si faltan (ya es el comportamiento actual, no lo rompas).
5. **Tests de integración contra PostgreSQL real** (`tests/integration/`), nunca mocks de base de datos.
6. **Logging con Winston** (`src/config/logger.js`), nunca `console.log` en código de producción.
7. **Errores siempre van a `errorHandler`** vía `next(err)`; los controladores no formatean errores de
   Zod ni de Postgres a mano.
8. El archivo de rutas de un módulo se llama **`<nombre>Routes.js`** o el loader dinámico
   (`src/createApp.js`) no lo monta.
9. Cada módulo nuevo se registra en la tabla `modulos` vía su propia migración
   (`INSERT ... ON CONFLICT (nombre) DO NOTHING`).

## Flujo de trabajo

- Ramas: `main` (estable), `develop` (integración, default), `feature/<nombre>` contra `develop`.
- Una rama por issue. PR a `develop` usando la plantilla (`.github/PULL_REQUEST_TEMPLATE.md`).
- Commits: Conventional Commits simple (`feat:`, `fix:`, `chore:`, `docs:`).
- **Ningún commit ni PR de este repo lleva línea de coautoría de ninguna IA/asistente** (sin
  `Co-Authored-By` de Claude, ChatGPT, Copilot, etc.). Usa la identidad Git normal del autor humano.
- Al cerrar un issue, actualiza `docs/` si el cambio afecta requisitos, diseño o decisiones de
  arquitectura (en ese caso, agrega un ADR nuevo en `docs/adr/`, no edites uno ya aceptado).

## Puertos (no genéricos — ver ADR 0004)

Backend `48500`, Postgres host `54329` (interno `5432`). Si vuelven a chocar en otra máquina, ajusta
`.env` y `docker-compose.yml`, no cambies el valor por defecto de `.env.example` sin avisar al equipo.

## Dónde mirar antes de preguntar

- Decisiones ya tomadas y su razón: [`docs/adr/`](docs/adr/).
- Alcance y requisitos: [`docs/01-requisitos/SRS.md`](docs/01-requisitos/SRS.md).
- Arquitectura y modelo de datos: [`docs/02-diseno/SDD.md`](docs/02-diseno/SDD.md).
- Backlog y prioridad: [Issues](https://github.com/Icebreaker26/portal-proyectos-backend/issues) +
  [Project board](https://github.com/users/Icebreaker26/projects/1).
