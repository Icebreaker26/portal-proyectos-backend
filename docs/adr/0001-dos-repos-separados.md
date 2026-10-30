# 0001 — Dos repositorios separados (backend/frontend)

## Contexto

El equipo (3 personas) necesita definir cómo organizar el código del Portal de Proyectos UCP: un monorepo o dos repositorios independientes.

## Decisión

Se usan dos repositorios Git independientes bajo la cuenta `Icebreaker26`: `portal-proyectos-backend` y `portal-proyectos-frontend`, dentro de una carpeta contenedora local `portal de proyectos ucp/`.

## Consecuencias

- Cada repo es autocontenible para desplegar como servicio independiente en Railway.
- La documentación de ingeniería (SRS/SDD/plan de pruebas/ADRs) vive en `backend/docs/` como punto único de verdad, y el frontend la referencia.
- Requiere coordinar versiones/branches entre ambos repos manualmente (no hay lockstep automático de monorepo).
