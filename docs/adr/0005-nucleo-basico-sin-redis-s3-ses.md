# 0005 — Núcleo básico de seguridad, sin la infraestructura pesada de Kernel

## Contexto

Kernel/CORE incluye Redis (blacklist de sesiones, forced-logout), lockdown automático + detección de anomalías, S3 prefirmado + SES/Resend para correo, y Socket.io para notificaciones en tiempo real. El poster de Portal de Proyectos UCP no menciona ninguno de estos: solo un volumen local para uploads, y no hay requerimiento de correo saliente ni tiempo real.

## Decisión

Se copia el núcleo básico de Kernel (JWT en cookie HttpOnly, bcrypt, tabla `global_usuarios`, ACL granular `modulos`/`acciones`/`permisos`, `checkPermission`, Zod en `env.js`, Winston, `errorHandler` centralizado, CORS por origen + CSRF por header `X-Requested-With`). No se incluye Redis, lockdown/`anomalyDetector`, S3/SES/Resend, ni Socket.io.

## Consecuencias

- Menos infraestructura que levantar y mantener para un proyecto académico de alcance acotado.
- Los uploads van al volumen local `/app/uploads` en vez de S3 prefirmado.
- Si el curso llegara a pedir notificaciones en tiempo real o envío de correo, se agrega como extensión posterior (no bloquea el alcance de Fase 1).
- No hay forced-logout ni blacklist de sesiones: un JWT comprometido es válido hasta que expira (8h). Aceptable para el alcance académico actual; revisar si el proyecto escala a uso real de la facultad.
