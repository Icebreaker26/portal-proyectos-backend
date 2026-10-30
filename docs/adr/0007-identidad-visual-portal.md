# 0007 — Identidad visual del portal: paleta institucional + kit de Kernel Créditos

## Contexto

El frontend no tiene ninguna identidad visual definida (ver issue frontend #11, "Definir
estética/identidad visual del proyecto"): `ListadoPublico.jsx` se renderiza sin estilos y no hay
layout/navbar del módulo `proyectos` (issue frontend #4). Por el ADR 0001 este repo no comparte
código con Kernel/CORE, pero sí puede compartir *convenciones visuales* si se deciden
explícitamente — no hay ningún estilo heredado por defecto.

Se investigaron dos fuentes antes de decidir:

1. **Kernel Créditos** (`Icebreaker26/kernel-frontend`, módulo `creditos`): el kit estético de
   referencia que se quería imitar por su limpieza. Créditos migró de Core OS (oscuro, `font-mono`)
   a un tema claro en el issue #117: fondo `#F6F8FA`, tarjetas/tablas blancas
   `rounded-xl border-slate-200 shadow-sm`, texto en `slate-*`, `font-sans`. Tablas:
   `thead bg-slate-50 text-[10px] tracking-widest text-slate-500`, filas
   `border-slate-100 hover:bg-slate-50`. Un acento de color por módulo (Créditos usa lima, decidido
   en el issue #174).
2. **Identidad institucional UCP**: verificada contra `https://www.ucp.edu.co/` (estilos
   computados) y el logo oficial. Verde `#00804E` es el color de acción real del sitio (botones);
   granate `#86191C` domina la barra de navegación; dorado `#DBA630` es un acento del escudo. El
   manual de marca 2025 existe públicamente pero no se pudo leer en el momento de esta decisión
   (PDF con texto comprimido) — los hex de arriba vienen de la observación directa del sitio y del
   logo, no del manual; si el manual se consigue legible más adelante y difiere, este ADR debe
   revisarse (no editarse — ver regla del `README.md` de este directorio).

## Decisión

Se adopta el **esqueleto** del kit de Kernel Créditos (fondo neutro, tarjetas/tablas blancas,
`shadow-sm` único, tipografía `slate-*`) pero con la **paleta institucional de la UCP** en vez del
lima/violeta de Kernel, y un solo acento para todo el portal (no uno por módulo como en Kernel,
porque este portal solo tiene `proyectos` y `votos` — es un producto cohesivo, no un monolito
multi-área).

**Paleta**

| Uso | Color |
|---|---|
| Franja superior del navbar (segmentada, 3 tercios iguales, ~3-4px) | `#86191C` → `#00804E` → `#DBA630` |
| Navbar (resto) | `bg-white`, `border-b border-slate-200` |
| Acento primario (botones, links, acción, link activo del navbar) | `#00804E` (verde UCP) |
| Estado `aprobado` | `#00804E` |
| Estado `pendiente` (badge) | `#DBA630` (dorado) |
| Estado `rechazado` | `#D83135` |
| Texto | `slate-*` (sin hex sueltos) |
| Fondo de página | `#F7F8FA` |

**Layout**

- Navbar superior fijo (no sidebar) — con solo dos módulos de negocio (`proyectos`, `votos`) un
  sidebar sería sobre-ingeniería.
- Contenido centrado, `max-w-5xl`/`max-w-6xl` (no full-bleed).
- Tarjetas y tablas: `rounded-xl border-slate-200 bg-white shadow-sm`.
- Tablas: `thead bg-slate-50 text-[10px] tracking-widest text-slate-500`; filas
  `border-t border-slate-100 hover:bg-slate-50`.

**Sombras**: una sola variante, `shadow-sm`, en tarjetas y tablas. Nada de `shadow-md`/`shadow-lg`
ni sombras de color. El hover de fila/tarjeta cambia el fondo (`hover:bg-slate-50`), no agrega
sombra.

**Animaciones (Framer Motion, ya en el stack vía issue frontend #1)**:
- Fade + slide corto (150–200ms) al entrar una vista o abrir un modal/drawer.
- Stagger suave al renderizar listas/tablas.
- Microinteracciones simples (hover de botones, color activo de links) resueltas con las utilidades
  de transición de Tailwind, sin Framer Motion — Framer se reserva para lo que Tailwind no cubre
  (entrada/salida de elementos, stagger).

**Responsive**: todo lo anterior (navbar, layout centrado, tarjetas, tablas) debe implementarse
mobile-first con los breakpoints estándar de Tailwind (`sm`/`md`/`lg`). En particular:
- El navbar colapsa a menú hamburguesa por debajo de `md`.
- Las tablas con muchas columnas (listados de proyectos, votos) deben tener una alternativa legible
  en mobile — scroll horizontal contenido (`overflow-x-auto` sobre el wrapper, nunca que desborde la
  página) o, si la tabla es simple, colapsar a tarjetas apiladas por fila.
- El contenido centrado (`max-w-*`) lleva padding lateral (`px-4`/`px-6`) para no pegarse a los
  bordes en pantallas angostas.

Esta decisión aplica a cualquier issue de UI del frontend de ahora en adelante (layout/navbar,
panel estudiante, panel profesor, UI de votos, listado público) — no se implementa ningún
componente visual nuevo sin seguir esta paleta/layout/responsive salvo que un ADR posterior lo
reemplace.

## Consecuencias

- El portal se ve coherente con la identidad de la UCP (algo que un estudiante/profesor reconoce)
  sin copiar literalmente el sitio institucional, que es mucho más denso.
- Se evita reinventar un sistema de diseño desde cero: se reutiliza una estructura (tablas,
  tarjetas, sombras, tipografía) ya probada y pulida en Kernel Créditos, solo cambiando la paleta.
- Los hex del manual de marca 2025 quedan sin confirmar formalmente; si alguien consigue leer el PDF
  y los colores oficiales difieren de los verificados en el sitio web, hay que revisar este ADR
  (crear uno nuevo que lo reemplace, no editar este).
- Queda explícito el requisito de responsive desde el diseño, no como un ajuste posterior — evita
  que los paneles (proyectos, votos, usuarios) se construyan solo pensando en desktop.
