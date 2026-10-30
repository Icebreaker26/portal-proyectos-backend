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

<!-- RF-01, RF-02... completar por issue -->

### Alta de cuentas (resuelto — ver ADR 0006)

Autorregistro (`POST /api/auth/registro`) restringido a correo `@ucp.edu.co`, siempre crea rol
`estudiante`. La promoción a `profesor` es manual (admin actualiza `global_usuarios.rol` en BD) —
no hay panel de administración de usuarios en Fase 1.

## 4. Requisitos no funcionales

<!-- Disponibilidad, seguridad, rendimiento, portabilidad (Docker), etc. -->

## 5. Casos de uso

<!-- Uno por bloque de trabajo del backlog (ver issues de Fase 1) -->
