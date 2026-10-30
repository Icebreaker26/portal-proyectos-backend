# Plan de pruebas

> Plantilla SWEBOK — Knowledge Area: Software Testing.

## 1. Estrategia

Jest + Supertest, **integración contra PostgreSQL real** (nunca mocks de base de datos). Solo se mockean servicios externos si en algún momento se agregan (no aplica en el alcance actual: no hay S3/SES).

## 2. Niveles de prueba

- **Integración de API**: un archivo por módulo en `tests/integration/<modulo>.test.js`.
- Agrupación por `describe`: Auth, Validación, CRUD, Filtros, Casos borde.

## 3. Criterios de aceptación

- Todo endpoint privado responde 401 sin cookie y 403 sin permiso.
- Todo endpoint `/pub` responde sin autenticación.
- Validación Zod responde 400 ante body inválido.
- Borrado = `is_active = false`, nunca `DELETE` físico, verificado en el test.

## 4. Estado

| Módulo | Cobertura actual |
|---|---|
| proyectos | Auth, pública, validación, CRUD, borrado lógico, visibilidad por rol (RF-04) |
| votos | Auth, validación, pública (conteo), CRUD, regla "un voto por usuario por proyecto" |
| usuarios | Auth, 403 para no-admin, validación, promoción de rol, reasignación de permisos |
| auth | Validación Zod, registro (rol por defecto, permisos asignados, correo duplicado 409, dominio institucional), login/logout, `GET /me` |
