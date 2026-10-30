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

```
global_usuarios                modulos              acciones
──────────────────             ───────────          ───────────
id UUID PK                     id SERIAL PK          id SERIAL PK
nombre TEXT                    nombre TEXT UNIQUE    nombre TEXT UNIQUE
email TEXT UNIQUE                 ▲                     ▲
password_hash TEXT                │                     │
rol TEXT CHECK(                  └──────┐      ┌───────┘
  estudiante|profesor|admin)            │      │
is_active BOOLEAN                    permisos
created_at / updated_at        ─────────────────────────
     ▲                         usuario_uuid UUID FK ──┐
     │                         modulo_id   INT  FK    │ PK compuesta
     │                         accion_id   INT  FK ────┘
     │                         (usuario_uuid, modulo_id, accion_id)
     │
     ├──────────────┐
     │              │
proyectos        votos
─────────────    ─────────────────────────
id UUID PK       id UUID PK
autor_uuid FK ──►│ usuario_uuid FK ──► global_usuarios
titulo TEXT      │ proyecto_id FK ───► proyectos
descripcion TEXT │ is_active BOOLEAN
repositorio_url  │ created_at
estado TEXT CHECK(  UNIQUE (usuario_uuid, proyecto_id)
  pendiente|aprobado|rechazado)
is_active BOOLEAN
created_at / updated_at
```

Notas:
- `acciones` hoy tiene `READ`, `WRITE`, `DELETE` (migración `0002`) y `APROBAR` (migración `0005`,
  exclusiva de `proyectos`, separada de `WRITE` para que un estudiante no pueda aprobar).
- `permisos` es la fuente de verdad del ACL; `rol` en `global_usuarios` solo decide qué permisos
  se insertan por defecto al crear la cuenta (`permisosDefaultService.js`) y si el usuario es
  `admin` (bypass total en `checkPermission.js`).
- Todas las PK de tablas de negocio son UUID; `modulos`/`acciones` son catálogos internos y usan
  `SERIAL` porque no se exponen por API ni se referencian desde el cliente.

## 3. Decisiones de diseño

Ver [`../adr/`](../adr/) para las decisiones registradas como ADR.

## 4. Diagrama de despliegue

- Fase de pruebas: Railway (Postgres administrado + 2 servicios en red privada).
- Destino final: servidor Linux propio de la UCP, mismo `docker-compose`.
