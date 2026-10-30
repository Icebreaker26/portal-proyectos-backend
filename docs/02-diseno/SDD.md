# Descripción de Diseño de Software (SDD)

> Plantilla SWEBOK — Knowledge Area: Software Design.

## 1. Vista de arquitectura

3 contenedores Docker en red interna `portal_net`:

```
                 HTTPS 443 → :80
Usuario ──────────────────────────► [frontend: nginx]
                                         │  /api proxy_pass
                                         ▼
                                   [backend: Node/Express :48500]
                                         │
                                         ▼
                                   [db: PostgreSQL :5432]
```

- `frontend` (nginx): único contenedor con puerto publicado. Sirve el build de React y hace proxy inverso a `/api`.
- `backend` (Node/Express, ESM): stateless, solo alcanzable por nombre de servicio dentro de `portal_net`.
- `db` (PostgreSQL): solo alcanzable por nombre de servicio.

Volúmenes: `uploads_vol` (archivos subidos) y `pg_data` (datos de Postgres).

## 2. Modelo de datos (ER)

<!-- completar con las tablas de migrations/: global_usuarios, modulos, acciones, permisos, proyectos, votos -->

## 3. Decisiones de diseño

Ver [`../adr/`](../adr/) para las decisiones registradas como ADR.

## 4. Diagrama de despliegue

- Fase de pruebas: Railway (Postgres administrado + 2 servicios en red privada).
- Destino final: servidor Linux propio de la UCP, mismo `docker-compose`.
