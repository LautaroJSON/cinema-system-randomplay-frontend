# Data Model: Aviso de carga al elegir un horario

La feature no agrega datos de dominio ni cambia los tipos de la API. Lo único con estado es la
espera en la interfaz.

## Horario en carga (estado de interfaz)

| Campo | Tipo | Origen | Regla |
|---|---|---|---|
| `pending` | booleano | `useLinkStatus()` de `next/link` | `true` desde que se activa el enlace hasta que termina la navegación. Next lo mantiene solo en el último enlace activado. |
| `hora` | texto | `formatearHora(horario.horaInicio)`, ya calculado en `TiraHorarios` | Se muestra en el aviso. |
| `sala` | texto | `horario.salaNombre` | Se muestra en el aviso. |
| `demorada` | booleano | temporizador de `AvisoCargaHorario` | `false` al montar; `true` a los `AVISO_DEMORA_MS` sin desmontarse. |

### Transiciones

```text
normal ──toque──▶ cargando ──5 s──▶ cargando + demora
cargando | cargando + demora ──navegación terminada / otro horario tocado──▶ normal
```

- La línea de demora aparece una sola vez por espera.
- Tocar otro horario desmonta el aviso del anterior (su temporizador se limpia) y empieza uno
  nuevo desde cero.

## Valores de experiencia nuevos

| Constante | Valor | Archivo | Uso |
|---|---|---|---|
| `AVISO_DEMORA_MS` | `5000` | `src/config/experiencia.ts` | Cuándo aparece la línea de demora (FR-005). |
| `ESPERA_LECTURA_MS` | `45_000` | `src/config/experiencia.ts` | Timeout de la lectura del mapa en el servidor (FR-008). |
