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

### Pregunta abierta: alta de cuentas

Hoy el único mecanismo de creación de usuarios es `scripts/seed.js` (crea un admin a mano). No hay
endpoint de registro. Falta decidir antes de construir el panel estudiante/profesor:

- ¿Autorregistro con dominio de correo restringido (`@ucp.edu.co`)?
- ¿El admin crea cuentas desde un panel?
- ¿Import masivo (CSV) como hace Kernel con los asociados?

Ver issue "Auth: JWT en cookie HttpOnly + bcrypt + tabla global_usuarios" en el repo backend.

## 4. Requisitos no funcionales

<!-- Disponibilidad, seguridad, rendimiento, portabilidad (Docker), etc. -->

## 5. Casos de uso

<!-- Uno por bloque de trabajo del backlog (ver issues de Fase 1) -->
