# 0006 — Autorregistro restringido a correo institucional, promoción a profesor manual

## Contexto

El SRS dejaba abierta la pregunta de cómo se crean las cuentas de estudiante/profesor: el único
mecanismo existente era `scripts/seed.js`, que crea un admin a mano. Sin un mecanismo de alta,
ningún estudiante ni profesor real podía entrar al sistema.

Opciones consideradas: autorregistro con dominio restringido, alta manual por el admin, import CSV
masivo (como hace Kernel con los asociados).

## Decisión

Autorregistro abierto (`POST /api/auth/registro`) restringido a correos que terminen en
`@ucp.edu.co`. Todo registro crea rol **`estudiante`** por defecto, con los permisos por defecto de
ese rol (`src/services/permisosDefaultService.js`). La promoción a **`profesor`** es manual por
ahora: el admin actualiza `global_usuarios.rol` y reasigna permisos directamente en base de datos
(o vía `scripts/seed.js` si se adapta). No se construye un panel de administración de usuarios en
Fase 1 — ver issue nuevo "Admin: promover usuario a profesor" para cuando se decida construirlo.

Como parte de esta decisión se separó la acción `APROBAR` de `WRITE` en el módulo `proyectos`
(migración `1772300000005_accion_aprobar.js`): antes, cualquier usuario con `WRITE` sobre
`proyectos` (incluyendo un estudiante recién registrado) podía golpear
`PUT /api/proyectos/:id/estado` y aprobar o rechazar proyectos. Ahora esa ruta exige
`checkPermission('proyectos', 'APROBAR')`, que solo reciben por defecto los usuarios con rol
`profesor` (y `admin`, que siempre pasa).

## Consecuencias

- Sin fricción para decenas de estudiantes: no dependen del admin para entrar.
- El rol sensible (`profesor`, con permiso `APROBAR`) queda fuera del autorregistro: solo se obtiene
  por promoción manual, evitando que cualquiera con correo institucional se autodesigne profesor.
- Dependencia del dominio de correo como única verificación de identidad institucional: no hay
  verificación de correo (confirmación por email) todavía — alguien con acceso a crear una cuenta
  `@ucp.edu.co` (aunque no sea la suya) podría registrarse. Aceptable para el alcance académico
  actual; revisar si el proyecto escala a uso real de la facultad.
- La promoción manual a profesor no escala bien si hay muchos profesores — si eso ocurre, construir
  el panel de administración pospuesto hoy.
