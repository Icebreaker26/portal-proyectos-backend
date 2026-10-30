# 0003 — ACL granular estilo Kernel/CORE

## Contexto

Se necesita decidir el nivel de granularidad del sistema de permisos: un simple chequeo de rol (estudiante/profesor/admin) o un ACL por módulo+acción como en Kernel/CORE.

## Decisión

Se adopta el ACL granular de Kernel/CORE: tablas `modulos`, `acciones`, `permisos(usuario_uuid, modulo_id, accion_id)` y middleware `checkPermission(modulo, accion)`. `admin` pasa siempre; los demás roles se siembran con sus permisos por defecto al crear el usuario.

## Consecuencias

- Los permisos se pueden ajustar en base de datos sin tocar código ni redeployar.
- Más trabajo inicial que un simple `if (rol === 'profesor')`, pero reutiliza un patrón ya probado en Kernel/CORE y escala mejor si el proyecto crece.
- Cada módulo nuevo debe registrarse en `modulos` vía migración (`ON CONFLICT DO NOTHING`), como ya hacen `proyectos` y `votos`.
