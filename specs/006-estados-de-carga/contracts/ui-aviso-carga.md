# Contrato de interfaz: aviso de carga al elegir un horario

Qué ve y qué oye el visitante desde que toca un horario hasta que se abre la función. Los textos
entre comillas son el copy propuesto (DESIGN.md §10).

## Horario tocado (`IndicadorCarga`, dentro del `<Link>`)

| Estado | Qué se ve | Lector de pantalla |
|---|---|---|
| Normal | Hora, sala y precio, como hoy | "20:30, Sala 2, $ 4.500,00" (sin cambios) |
| Cargando (`pending`) | Hora y sala iguales; en el lugar del precio, **"Cargando…"**; borde `--oro` | Sin cambios en el nombre del enlace; anuncia el aviso inferior |

- El tamaño del horario no cambia (precio e indicador comparten celda, research R2).
- Solo el último horario activado queda en carga.
- Sin animación.

## Aviso inferior (`AvisoCargaHorario`, en un portal)

| Momento | Texto visible | Anuncio (`role="status"`, cortés) |
|---|---|---|
| Al activar | **"Cargando las butacas de las 20:30, Sala 2…"** | El mismo texto, una vez |
| Desde los 5 s | Se suma **"Esto puede tardar un poco más. No hace falta recargar la página."** | La línea nueva, una vez |
| Navegación terminada | Desaparece | Nada |

- Barra fija abajo, ancho del contenido con gutter de 16 px en móvil, fondo `--surface`, borde
  superior `--line-strong`, texto `--paper` y la línea de demora en `--paper-muted`.
- `pointer-events: none`: no bloquea toques. No recibe foco.
- `padding-bottom` incluye `env(safe-area-inset-bottom)`.
- Sin animación de entrada ni de salida.

## Sin cambios

- La página de la función responde como hoy: `200` con la función, `404` si no existe o el id
  está mal formado, "Esta función ya empezó" ante `410`, error recuperable ante fallas.
- Sin JavaScript, el horario es un enlace común y no hay aviso.
- Entrar por enlace directo o recargar no muestra aviso.
