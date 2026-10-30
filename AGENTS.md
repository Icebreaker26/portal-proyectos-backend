# AGENTS.md — Backend Portal de Proyectos UCP

Convenciones de este repo para cualquier agente o colaborador nuevo. Este archivo es autocontenido:
no asume acceso a ningún otro proyecto, skill o configuración externa. Si algo aquí entra en
conflicto con lo que observas en el código, el código manda — abre un issue señalando la diferencia.

## Qué es este proyecto

API REST del Portal de Proyectos UCP (ver [`docs/01-requisitos/SRS.md`](docs/01-requisitos/SRS.md)
para el alcance completo). Monolito modular: un núcleo transversal (auth, permisos, logging) +
módulos de negocio enchufables (`proyectos`, `votos`) que se autodescubren por convención de carpetas.

## Estado actual (ver también los issues del milestone "Fase 1")

**Verificado funcionando** (`npm install`, `docker compose up -d db`, `npm run migrate:up`, `npm run
dev`, `npm test`, y probado a mano con curl + navegador real: registro, login, crear proyecto,
rechazo 403 al intentar aprobar como estudiante):
- Núcleo completo: `src/config/env.js`, `src/db/database.js`, `src/middlewares/*`, `src/createApp.js`.
- `auth`: login/logout/me/registro. Registro solo `@ucp.edu.co`, crea rol `estudiante` (ADR 0006).
- ACL granular: `checkPermission`, `permisosDefaultService.js` (permisos por defecto por rol),
  acción `APROBAR` separada de `WRITE` — un estudiante no puede aprobar proyectos.
- Módulo `proyectos`: CRUD + ruta pública `/pub` + endpoint de aprobar/rechazar.
- Módulo `votos`: CRUD básico (regla "un voto por proyecto" a nivel de constraint UNIQUE en BD).
- Migraciones 0001–0005, todas corridas sin error contra Postgres 16 real.
- `tests/integration/proyectos.test.js`: 100% verde. `votos.test.js`: solo el caso de auth, el resto
  queda con un TODO explícito en el archivo.
- `docker-compose.yml` con nombre de proyecto propio (`name: portal-proyectos-backend` — necesario
  porque el autor tiene otro proyecto en una carpeta también llamada `backend`, y sin esto Docker
  Compose los confunde; ver issue "Dockerfile + docker-compose").

**Verificado funcionando (actualización 2026-10-30):**
- `docker compose up -d --build backend` construye y arranca la imagen completa (no solo `db`),
  responde en `http://localhost:48500/api/proyectos/pub`. Se corrigieron dos bugs al probarlo:
  `DATABASE_URL` apuntaba a `localhost`, que dentro del contenedor no es el host de Postgres —
  ahora `docker-compose.yml` la sobreescribe a `db:5432` solo para el servicio `backend`; y faltaba
  `.dockerignore`, así que `COPY . .` pisaba el `node_modules` de Linux recién instalado con el del
  host (Windows), rompiendo el binario nativo de `bcrypt` — ya existe `.dockerignore` excluyendo
  `node_modules`, `.env`, `.git`.
- Reglas de visibilidad de `proyectos` (`GET /api/proyectos`, RF-04 en el SRS): quien tiene permiso
  `APROBAR` (profesor/admin) ve todos los proyectos activos; quien no, ve los suyos en cualquier
  estado + los `aprobado` de otros. Implementado en
  `src/modules/proyectos/services/proyectosService.js::listar` + test de visibilidad en
  `tests/integration/proyectos.test.js`.
- `tests/integration/votos.test.js` completo: CRUD, validación, conteo público y la regla "un voto
  por usuario por proyecto" (el upsert reactiva el mismo voto en vez de duplicarlo).
- Módulo nuevo `usuarios` (issue #10): `GET /api/usuarios` y `PUT /api/usuarios/:id/rol`
  (admin-only vía ACL — nadie tiene permisos `usuarios:*` por defecto), reasigna los permisos del
  rol nuevo sobre `proyectos`/`votos` y limpia los del anterior. Migración
  `1772300000006_modulo_usuarios.js`. Test en `tests/integration/usuarios.test.js`.
- `docs/01-requisitos/SRS.md`, `docs/02-diseno/SDD.md` y `docs/03-pruebas/plan-de-pruebas.md`
  rellenos con el contenido real (requisitos funcionales RF-01..RF-07, modelo ER, estado de
  cobertura de tests).
- `tests/integration/auth.test.js`: validación Zod, registro (rol estudiante por defecto, permisos
  asignados, correo duplicado → 409, dominio `@ucp.edu.co`), login/logout, `GET /me`.
- Suite completa: `npm test` → 34/34 verde contra Postgres real.

**Pendiente:**
1. **Deploy en Railway (issue #8)** — decidido no hacerlo todavía (el autor avisó que lo deja para
   más adelante). Requiere `railway login` (cuenta del autor) antes de que un agente pueda continuar
   con `railway init` / provisión de Postgres / variables de entorno; no lo hagas sin que el autor
   haya iniciado sesión primero.
2. Panel de promoción a profesor — el **backend** (issue #10) ya está hecho (ver arriba). La pieza
   de **frontend** quedó registrada como issue propio en el otro repo:
   [portal-proyectos-frontend#12](https://github.com/Icebreaker26/portal-proyectos-frontend/issues/12).
   Prioridad baja, no bloquea nada de este repo.

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
