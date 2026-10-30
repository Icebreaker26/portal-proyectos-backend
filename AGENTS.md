# AGENTS.md — Backend Portal de Proyectos UCP

Convenciones de este repo para cualquier agente o colaborador nuevo. Este archivo es autocontenido:
no asume acceso a ningún otro proyecto, skill o configuración externa. Si algo aquí entra en
conflicto con lo que observas en el código, el código manda — abre un issue señalando la diferencia.

## Qué es este proyecto

API REST del Portal de Proyectos UCP (ver [`docs/01-requisitos/SRS.md`](docs/01-requisitos/SRS.md)
para el alcance completo). Monolito modular: un núcleo transversal (auth, permisos, logging) +
módulos de negocio enchufables (`proyectos`, `votos`) que se autodescubren por convención de carpetas.

## Estado actual (última actualización: 2026-10-30)

**Verificado funcionando end-to-end** (`npm install`, `docker compose up -d --build`, `npm run
migrate:up`, `npm test`, y probado a mano con curl + navegador real):

- **Núcleo**: `env.js`, `database.js`, middlewares, loader dinámico de módulos.
- **Auth**: registro solo `@ucp.edu.co` → rol `estudiante` (ADR 0006), login/logout/me.
- **ACL granular**: `checkPermission`, permisos por defecto por rol, `APROBAR` separado de `WRITE`.
- **Módulo `usuarios`**: `GET /api/usuarios`, `PUT /api/usuarios/:id/rol` (admin-only), promueve/
  devuelve estudiante↔profesor reasignando permisos.
- **Módulo `votos`**: CRUD, un voto por usuario/proyecto (UNIQUE + upsert idempotente), conteo
  público.
- **Módulo `proyectos` con modelo extendido (ADR 0008)**: programa/asignatura/semestre/tipo,
  profesor (FK validado), resumen, cuerpo (Markdown — el frontend sanitiza al renderizar, nunca
  HTML crudo), stack/palabras clave, video/demo URLs, slug único, visibilidad
  (publico/comunidad/privado), licencia. Participantes con rol/orden de autoría y **consentimiento
  de publicación obligatorio antes de aprobar** (`proyecto_participantes`,
  `PUT /:id/consentimiento`). Historial de aprobación/rechazo con comentario
  (`proyecto_revisiones`). Archivos adjuntos con hash SHA-256, límite 10MB, solo PDF/PNG/JPEG/WEBP
  (`proyecto_archivos`, `POST/GET /:id/archivos`, `GET /archivos/:id/descargar` — descarga del
  binario exige sesión a propósito, los metadatos ya son públicos vía `/pub/:id`).
- **`GET /api/proyectos/:id`** (autenticado — "expediente"): a diferencia de `/pub/:id` (solo
  aprobado+público), trae cualquier proyecto al que el usuario tenga acceso (autor, participante,
  o ya aprobado), con participantes, archivos y el historial de revisiones. Existe porque el
  frontend decidió que aprobar/rechazar **solo** se puede hacer desde el expediente completo del
  proyecto, nunca desde una fila de tabla — devuelve 404 (no 403) a quien no debería verlo, para no
  revelar que el proyecto existe.
- **Docker**: `docker compose up -d --build backend` funciona completo (no solo `db`); nombre de
  proyecto propio para no chocar con otras carpetas `backend` del autor.
- **Documentación**: `docs/01-requisitos/SRS.md`, `docs/02-diseno/SDD.md`,
  `docs/03-pruebas/plan-de-pruebas.md` con contenido real; 9 ADRs en `docs/adr/`.
- **Datos de prueba**: `npm run seed:demo` (idempotente) — 7 usuarios (`Demo1234!`), 8 proyectos en
  los tres estados con campos extendidos, participantes y votos. Uno de ellos (`Bot de Telegram
  para consultas de biblioteca`) tiene a propósito un coautor sin consentir, para probar la regla
  de aprobación.
- **Suite completa**: `npm test` → 70/70 verde contra Postgres real.

**Pendiente — empieza aquí:**

1. **[Issue #12](https://github.com/Icebreaker26/portal-proyectos-backend/issues/12)** — dos
   endpoints que el frontend necesita y no existen (bloquean parte de
   [portal-proyectos-frontend#14](https://github.com/Icebreaker26/portal-proyectos-frontend/issues/14),
   ya cerrado con ese hueco documentado): listar cuentas con rol `profesor` sin ser admin, y buscar
   una cuenta por email para agregar coautores con cuenta real (pensar el riesgo de enumeración de
   usuarios). Incluye exponer de alguna forma "en qué proyectos tengo que confirmar mi
   consentimiento" para un participante autenticado.
2. **Deploy en Railway (issue #8)** — pausado por decisión del autor. Requiere `railway login`
   (cuenta del autor) antes de continuar con `railway init`/provisión de Postgres/variables de
   entorno; no lo hagas sin que el autor haya iniciado sesión primero.
3. **Fase 2 del ADR 0008** (eventos/ferias, reconocimientos, moderación/reportes, contexto
   institucional, versionado post-aprobación) — documentada pero sin issue abierto; crear uno
   cuando se priorice.

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
10. **`cuerpo` de un proyecto es Markdown, nunca HTML** — si algún endpoint nuevo llega a
    renderizarlo server-side, sanitizar (ADR 0008); el frontend ya sanitiza al mostrarlo.
11. Archivos subidos van a `uploads/` (gitignored, `uploads_vol` en Docker) — nunca commitear
    binarios de prueba ni asumir que el volumen persiste sin backup antes de depender de él en
    producción.

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
