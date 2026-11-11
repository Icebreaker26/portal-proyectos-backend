# Cuentas de prueba — Portal de Proyectos UCP

Generadas por `npm run seed:demo` ([`scripts/seedDemo.js`](scripts/seedDemo.js)). Apunta solo a la
base de datos local de desarrollo (`localhost:54329`, `NODE_ENV=development`) — nunca correr este
seed contra producción.

**Contraseña de todas las cuentas:** `Demo1234!`

| Rol | Nombre | Email |
|---|---|---|
| Admin | Admin Demo | `admin@ucp.edu.co` |
| Profesor | Laura Gómez | `profesor1@ucp.edu.co` |
| Profesor | Carlos Ríos | `profesor2@ucp.edu.co` |
| Estudiante | Juan Pérez | `estudiante1@ucp.edu.co` |
| Estudiante | María Torres | `estudiante2@ucp.edu.co` |
| Estudiante | Andrés López | `estudiante3@ucp.edu.co` |
| Estudiante | Valentina Ruiz | `estudiante4@ucp.edu.co` |

## Cómo levantar el sistema

```bash
# Backend (repo portal-proyectos-backend)
docker compose up -d db        # solo la base de datos
npm run migrate:up
npm run seed:demo              # (re)genera estas cuentas y los proyectos de abajo
npm run dev                    # http://localhost:48500

# Frontend (repo portal-proyectos-frontend), en otra terminal
npm run dev                    # http://localhost:39173
```

## Proyectos sembrados

Son 6 repos **reales** de [github.com/Icebreaker26](https://github.com/Icebreaker26) (el autor),
"adjudicados" a las cuentas de estudiante/profesor de prueba de arriba — ningún estudiante o
profesor de esta lista es una persona real, solo los repositorios lo son.

| Proyecto | Repo | Autor | Estado |
|---|---|---|---|
| The Linkin Tool — Planificación de enlaces PTP | [thelinkintool](https://github.com/Icebreaker26/thelinkintool) | estudiante3 | Aprobado |
| Moodle Tracker | [moodle-tracker](https://github.com/Icebreaker26/moodle-tracker) | estudiante1 | Aprobado |
| UCP Markdown CLI — Informe de opción de grado | [ucp-markdown-cli](https://github.com/Icebreaker26/ucp-markdown-cli) | estudiante2 | **Pendiente** |
| Instalador automatizado CachyOS | [cachy-custom-installer](https://github.com/Icebreaker26/cachy-custom-installer) | estudiante4 | Rechazado |
| CORE — Motor de gestión legal, ambiental y contractual | [legal-case-engine-frontend](https://github.com/Icebreaker26/legal-case-engine-frontend) | profesor1 | Aprobado |
| Fábrica de reels 3D — motor + kits de estilo | [3d-animations-showcase](https://github.com/Icebreaker26/3d-animations-showcase) (privado) | estudiante3 | Aprobado |

**Caso de prueba del consentimiento:** "UCP Markdown CLI" tiene a `estudiante4` como coautor
**sin consentir** — entra como `estudiante4@ucp.edu.co` al expediente de ese proyecto
(`/proyectos/:id`) para ver el botón "Confirmar mi consentimiento", y si entras como `profesor1`
o `profesor2` verás que el backend rechaza aprobarlo hasta que lo confirme (`409`).

## Qué probar con cada rol

- **Estudiante** (`estudiante1`–`estudiante4`): ver `/proyectos` (lo propio + lo aprobado de
  otros), crear un proyecto nuevo en `/proyectos/nuevo` (selector de profesor, búsqueda de
  coautor por email, preview de portada), votar proyectos públicos, eliminar un proyecto propio
  desde su expediente.
- **Profesor** (`profesor1`, `profesor2`): todo lo anterior + aprobar/rechazar desde el
  expediente completo de cualquier proyecto pendiente, ver el badge "Requiere tu consentimiento"
  en la tabla cuando aplique.
- **Admin** (`admin@ucp.edu.co`): todo lo anterior + `/admin/usuarios` para promover/devolver
  estudiante↔profesor (con buscador y confirmación inline).
- **Sin sesión**: `/proyectos/pub` (vitrina pública) y `/proyectos/pub/:id` — solo se ven los 4
  proyectos aprobados y públicos; "UCP Markdown CLI" (pendiente) e "Instalador automatizado
  CachyOS" (rechazado) no aparecen ahí a propósito.
