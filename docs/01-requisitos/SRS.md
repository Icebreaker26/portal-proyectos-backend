# Especificación de Requisitos de Software (SRS)

> Plantilla SWEBOK — Knowledge Area: Software Requirements. Se completa a medida que se resuelven los issues de Fase 1.

## 1. Alcance

Portal de Proyectos UCP: plataforma donde estudiantes suben proyectos de curso, profesores los aprueban o publican los suyos, cualquier visitante consulta los proyectos aprobados, y usuarios autenticados votan.

## 2. Actores

| Actor | Descripción |
|---|---|
| Visitante | Sin sesión. Solo lectura pública (`/api/<modulo>/pub`). |
| Estudiante | Sube proyectos, vota. |
| Profesor | Aprueba/rechaza proyectos, publica los suyos, vota. |
| Admin | Gestión de usuarios y permisos. |

## 3. Requisitos funcionales

### Alta de cuentas (resuelto — ver ADR 0006)

Autorregistro (`POST /api/auth/registro`) restringido a correo `@ucp.edu.co`, siempre crea rol
`estudiante`. La promoción a `profesor` es manual (admin actualiza `global_usuarios.rol` en BD) —
no hay panel de administración de usuarios en Fase 1 (ver issue #10, baja prioridad).

### RF-01 — Autenticación

El sistema debe permitir registro (`POST /api/auth/registro`), login (`POST /api/auth/login`,
cookie JWT HttpOnly), logout (`POST /api/auth/logout`) y consulta de sesión (`GET /api/auth/me`).
Login y registro están bajo rate limit (20 intentos / 15 min) por ser los endpoints públicos más
sensibles del sistema.

### RF-02 — Gestión de proyectos

Un estudiante o profesor autenticado puede crear un proyecto (`POST /api/proyectos`), que queda en
estado `pendiente`. El autor y quien tenga permiso `APROBAR` (profesor/admin) pueden ver el proyecto
antes de su aprobación; el resto de usuarios autenticados y los visitantes no.

### RF-03 — Aprobación de proyectos

Solo quien tiene el permiso `proyectos:APROBAR` (profesor o admin) puede cambiar el estado de un
proyecto a `aprobado` o `rechazado` (`PUT /api/proyectos/:id/estado`). Un estudiante con permiso
`WRITE` no puede ejecutar esta acción (ver ADR 0003 y migración `1772300000005_accion_aprobar.js`).

### RF-04 — Visibilidad de proyectos

- **Visitante** (`GET /api/proyectos/pub`): solo proyectos `aprobado` y `is_active = true`.
- **Usuario autenticado sin permiso `APROBAR`** (`GET /api/proyectos`): sus propios proyectos en
  cualquier estado, más los proyectos `aprobado` de otros autores.
- **Usuario con permiso `APROBAR`** (profesor/admin): todos los proyectos activos, de cualquier
  autor y en cualquier estado, para poder moderarlos.

### RF-05 — Votación

Un usuario autenticado con permiso `votos:WRITE` puede votar un proyecto (`POST /api/votos`) y
retirar su voto (`DELETE /api/votos/:proyectoId`, borrado lógico). Un mismo usuario solo puede tener
un voto activo por proyecto (constraint `UNIQUE (usuario_uuid, proyecto_id)` sobre upsert — votar de
nuevo reactiva el mismo voto en vez de duplicarlo). El conteo de votos por proyecto es público
(`GET /api/votos/pub/:proyectoId/conteo`).

### RF-06 — Promoción de rol (issue #10)

Un admin puede listar usuarios (`GET /api/usuarios`) y cambiar el rol de `estudiante` a `profesor`
o viceversa (`PUT /api/usuarios/:id/rol`), módulo `usuarios` — nadie más tiene permisos sobre este
módulo por defecto, así que en la práctica es admin-only. Al cambiar de rol se reasignan los
permisos por defecto del nuevo rol sobre `proyectos`/`votos` (ver `permisosDefaultService.js`),
limpiando antes los del rol anterior. El rol `admin` no se asigna por esta vía — sigue siendo
manual en BD.

### RF-07 — Borrado lógico

Ningún módulo de negocio (`proyectos`, `votos`, `global_usuarios`) elimina filas físicamente;
`DELETE` marca `is_active = false`.

## 4. Requisitos no funcionales

- **Seguridad**: JWT en cookie HttpOnly; contraseñas con `bcrypt`; cabeceras de seguridad con
  `helmet`; CORS restringido a `FRONTEND_URL`; rate limiting en endpoints públicos sensibles
  (auth, `/pub`); ACL granular por módulo+acción (`permisos`), sin excepción de ruta privada.
- **Portabilidad**: todo el stack corre con `docker-compose` (backend, Postgres); variables de
  entorno validadas con un schema Zod al arrancar — el proceso aborta si falta alguna.
- **Mantenibilidad**: módulos de negocio autodescubiertos por convención de carpetas
  (`src/modules/<nombre>/routes/<nombre>Routes.js`); nuevo módulo no requiere tocar el núcleo.
- **Trazabilidad de errores**: logging estructurado con Winston, nunca `console.log`; todos los
  errores pasan por un `errorHandler` centralizado.
- **Disponibilidad**: sin alta disponibilidad en Fase 1 — un solo nodo backend + un solo nodo
  Postgres, aceptable para el alcance de proyecto académico.

## 5. Casos de uso

| Caso de uso | Actor(es) | Resumen |
|---|---|---|
| Registrarse | Estudiante | Correo `@ucp.edu.co` + contraseña → cuenta con rol `estudiante`. |
| Iniciar/cerrar sesión | Todos los autenticados | Login/logout por cookie JWT. |
| Publicar proyecto | Estudiante, Profesor | Crea proyecto en estado `pendiente`. |
| Aprobar/rechazar proyecto | Profesor, Admin | Cambia el estado de un proyecto ajeno. |
| Consultar proyectos aprobados | Visitante | `GET /api/proyectos/pub`, sin sesión. |
| Consultar proyectos propios y aprobados | Estudiante, Profesor | `GET /api/proyectos` filtrado según RF-04. |
| Votar / retirar voto | Estudiante, Profesor | Un voto activo por proyecto por usuario. |
| Consultar conteo de votos | Visitante | `GET /api/votos/pub/:proyectoId/conteo`. |
