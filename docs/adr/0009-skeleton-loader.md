# 0009 — Skeleton loader como estado de carga

Extiende el ADR 0007 (identidad visual del portal) — no lo reemplaza, lo complementa con una
regla que faltaba: cómo se ve un componente mientras carga datos.

## Contexto

Hoy todas las vistas que hacen fetch (`ListadoPublico`, `ListadoProyectos`, `DetalleProyecto`,
`PanelUsuarios`) muestran un texto plano `"Cargando…"` mientras esperan la respuesta del backend.
Funciona, pero no sigue ningún lenguaje visual — es el único lugar del portal sin la estética
definida en el ADR 0007, y salta más entre el estado de carga y el contenido real en vez de
anticipar la forma de lo que va a aparecer.

## Decisión

Reemplazar los estados `"Cargando…"` por **skeleton loaders**: bloques con la silueta exacta del
contenido real (fila de tabla, tarjeta de detalle), no un spinner genérico.

- **Color**: `bg-slate-200` con `animate-pulse` (utilidad nativa de Tailwind, sin dependencia
  nueva). Un tono más oscuro que el `bg-slate-50` de los `thead`, para que el "hueco" se note
  sobre el fondo blanco de tarjetas/tablas.
- **Forma**: mismo `rounded-xl`/`shadow-sm` que el contenido real que reemplaza — el skeleton de
  una fila de tabla tiene el ancho/alto de esa fila, el de una tarjeta de detalle tiene el ancho/
  alto de esa tarjeta. Nunca un bloque genérico centrado de "cargando".
- **Sin Framer Motion aquí**: el pulso de `animate-pulse` ya es la señal de carga; una animación
  de entrada encima sería ruido. La transición fade/slide del ADR 0007 sigue aplicando normal
  cuando el skeleton se reemplaza por el contenido real (ese es el único framer-motion de la
  secuencia).

Esta regla aplica a toda vista que haga fetch antes de renderizar — no solo a las cuatro
existentes. La implementación concreta en cada vista queda para cuando se rediseñen (no es parte
de este ADR, que solo fija la regla).

## Consecuencias

- Una dependencia menos: no se evaluó ninguna librería de skeleton — `animate-pulse` de Tailwind
  alcanza para lo que necesita este portal.
- Las vistas existentes (`ListadoPublico`, `ListadoProyectos`, `DetalleProyecto`,
  `PanelUsuarios`) quedan con un hueco de implementación hasta que se les aplique esta regla — no
  es una regresión, es un rediseño pendiente y explícitamente registrado como tal.
