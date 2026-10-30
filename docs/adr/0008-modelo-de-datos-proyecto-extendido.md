# 0008 — Modelo de datos extendido de "proyecto"

## Contexto

El modelo actual de `proyectos` (migración `1772300000003_proyectos.js`) es deliberadamente
mínimo: `titulo`, `descripcion`, `repositorio_url`, `estado`. Alcanzó para el MVP funcional
(crear, aprobar/rechazar, listar, votar), pero no alcanza como portal de proyectos académicos
real: no hay forma de saber el programa/asignatura de un proyecto, quién participó más allá del
autor que lo subió, por qué se rechazó, ni nada que sirva como portafolio presentable
(resumen corto, imagen de portada, archivos adjuntos).

Se discutió el alcance con el autor y se consultó a un segundo modelo (Opus) para no dejar
huecos obvios de un portal de este tipo. De ahí salieron ~25 campos/conceptos candidatos. Antes
de migrar nada, este ADR decide **cuáles entran ahora (MVP extendido)** y **cuáles se posponen**,
y cómo se modelan (columnas vs. tablas relacionadas) para no acumular deuda de migraciones.

## Decisión

### Regla de diseño

Un dato que tiene **cardinalidad variable** respecto al proyecto (varios participantes, varias
revisiones, varios archivos, varios reconocimientos) **es una tabla aparte**, nunca una columna
serializada ni una lista en JSON. Esto es lo que ya hace este repo con `votos`/`permisos`, y es
lo que permite que el MVP empiece simple y crezca sin migraciones dolorosas.

### Fase 1 — MVP extendido (se implementa ahora, ver issue backend)

**Columnas nuevas en `proyectos`:**

| Campo | Tipo | Notas |
|---|---|---|
| `programa` | TEXT | Programa académico (ej. "Ingeniería de Sistemas") |
| `asignatura` | TEXT | Curso/asignatura del proyecto |
| `semestre` | TEXT | Período académico, ej. `2026-1` |
| `tipo_proyecto` | TEXT CHECK | `investigacion` / `aplicativo` / `trabajo_de_grado` / `otro` |
| `profesor_uuid` | UUID NULL, FK → `global_usuarios` | Opcional; debe tener `rol IN ('profesor','admin')` (constraint o validación en servicio) |
| `resumen` | TEXT, máx ~300 car. | Abstract corto para tarjetas de listado y Open Graph (compartir en redes) |
| `imagen_portada_url` | TEXT NULL | Referencia al archivo de portada (ver `proyecto_archivos`) |
| `cuerpo` | TEXT | Markdown, **nunca HTML crudo** (ver "Consecuencias" — riesgo XSS) |
| `stack` | TEXT[] | Tags de tecnologías, para portafolio y búsqueda |
| `palabras_clave` | TEXT[] | Tags libres de búsqueda |
| `video_demo_url` | TEXT NULL | Link externo (YouTube/Drive), nunca archivo de video |
| `demo_url` | TEXT NULL | Enlace a demo en vivo, si aplica |
| `slug` | TEXT UNIQUE | URL permanente — ver tabla `proyecto_slugs_historicos` |
| `visibilidad` | TEXT CHECK, default `publico` | `publico` / `comunidad` (solo autenticados) / `privado` |
| `licencia` | TEXT NULL | Ej. `MIT`, `CC-BY-4.0`; NULL = todos los derechos reservados |

**Tablas nuevas:**

- **`proyecto_participantes`**: `proyecto_id`, `usuario_uuid` (NULL si la persona no tiene cuenta
  — ver `nombre_libre`), `nombre_libre` TEXT NULL, `rol` (`lider`/`desarrollo`/`diseno`/
  `investigacion`), `orden_autoria` INT, `aporte` TEXT NULL, `consiente_publicacion` BOOLEAN
  default false. **No se marca `aprobado` el proyecto sin que cada participante con cuenta en el
  portal haya marcado su consentimiento** (Ley 1581 de 2012 — protección de datos; derechos de
  autor compartidos).
- **`proyecto_revisiones`**: `proyecto_id`, `estado_anterior`, `estado_nuevo`, `revisor_uuid`,
  `comentario` TEXT NULL (aquí vive el motivo de rechazo), `created_at`. Reemplaza la idea de un
  campo suelto "motivo_rechazo" — da auditoría completa y permite reenviar tras corregir sin
  perder el historial.
- **`proyecto_archivos`**: `proyecto_id`, `tipo` (`pdf`/`imagen`/`otro`), `url` o path en
  `uploads_vol` (el volumen ya existe en `docker-compose.yml`, sin usar hasta ahora — ver ADR
  0005, que descartó S3 para el alcance de Fase 1), `mime_type`, `tamano_bytes`, `hash_sha256`
  (detecta duplicados/plagio entre periodos), `descripcion_alt` TEXT NULL (accesibilidad de
  imágenes), `estado_escaneo` (`pendiente`/`limpio`/`sospechoso`, aunque el escaneo real de
  malware queda fuera de alcance de Fase 1 — el campo solo deja el hueco listo).
- **`proyecto_slugs_historicos`**: `slug_anterior`, `proyecto_id`, `created_at`. Redirige
  enlaces viejos cuando cambia el título (y por tanto el slug) de un proyecto ya compartido.

### Fase 2 — pospuesto (issue aparte cuando se priorice)

No se modela todavía, pero se deja registrado para no reinventarlo después:

- **Eventos/convocatorias** (`eventos`, `proyecto_id` → `evento_id`): ferias de proyectos,
  muestras semestrales con apertura/cierre de votación.
- **Reconocimientos/destacados** (`proyecto_reconocimientos`, y un `destacado` curado aparte de
  los votos — la popularidad no debe ser la única señal de calidad).
- **Moderación comunitaria** (`reportes`: quién reporta, motivo, estado, quién resolvió; límite
  de bloqueo de votación por proyecto).
- **Contexto institucional** (`entidad_aliada`, `ods` TEXT[], `grupo_investigacion`) — relevante
  para reporte de acreditación CNA, no bloquea el uso estudiantil del portal.
- **Versionado de contenido post-aprobación** — hoy un profesor puede editar el proyecto después
  de aprobado sin que vuelva a revisión; aceptable mientras el volumen sea bajo y manejable a
  mano.
- Menciones menores sin desarrollar aún: contador de vistas, calificación privada opcional,
  DOI/enlace a repositorio institucional (trabajos de grado), `estado_proyecto`
  (activo/finalizado/abandonado).

## Consecuencias

- **Riesgo de XSS si `cuerpo` se renderiza mal**: el campo es Markdown, no HTML. El render en
  frontend debe pasar por un parser de Markdown a HTML sanitizado (ej. `react-markdown` sin
  `rehype-raw`, o con sanitización explícita tipo `sanitize-html`/DOMPurify) — nunca
  `dangerouslySetInnerHTML` con el texto del usuario sin sanitizar. Esto bloquea la idea original
  de "editor HTML libre".
- **Storage de archivos**: sin S3 (ADR 0005), los archivos van al volumen `uploads_vol` ya
  declarado en `docker-compose.yml`. Hay que decidir el backup de ese volumen antes de depender
  de él en producción (fuera de alcance de este ADR).
- **Migraciones más grandes**: pasar de 4 columnas a un modelo con 5 tablas nuevas es un salto
  considerable de una sola vez. Se decidió aceptarlo (en vez de ir campo por campo) porque evita
  migraciones repetidas sobre la misma tabla en las próximas semanas, mientras el proyecto está
  en desarrollo activo.
- **Frontend**: el formulario de creación/edición de proyecto, el listado y el detalle necesitan
  rediseñarse para los campos nuevos — queda como issue aparte en `portal-proyectos-frontend`.
- La Fase 2 queda fuera a propósito: son features de gobernanza/institucionales que no bloquean
  que el portal funcione para Fase 1 del curso.
