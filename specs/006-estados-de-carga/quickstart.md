# Quickstart: validar el aviso de carga

Detalle de cada estado en [contracts/ui-aviso-carga.md](contracts/ui-aviso-carga.md).

## Requisitos

- Node.js LTS y dependencias instaladas (`npm install`).
- `.env.local` con `API_URL=http://127.0.0.1:4010` y `SITE_URL=http://localhost:3000`.

## 1. Backend lento con el mock

```bash
MOCK_DATOS=fixtures MOCK_DEMORA_MS=30000 npm run mock:api
```

```bash
npm run build && npm start
```

Con `MOCK_DEMORA_MS`, el mapa de la función lenta de los fixtures (`ID_FUNCION_LENTA`) tarda
30 s, como un backend dormido. El resto responde normal.

## 2. Recorrido

1. Abrir el detalle de la película que tiene el horario de la función lenta y tocarlo.
   - **Esperado**: al instante el horario dice "Cargando…" en lugar del precio, con borde
     dorado, sin cambiar de tamaño; abajo aparece "Cargando las butacas de las {hora}, {sala}…".
2. Esperar 5 s.
   - **Esperado**: el aviso suma "Esto puede tardar un poco más. No hace falta recargar la
     página.", sin animación.
3. Esperar a que termine (unos 30 s).
   - **Esperado**: se abre la página de la función, no la de error. El aviso desaparece.
4. Volver atrás y tocar un horario de otra función (rápida).
   - **Esperado**: la función se abre sin demora; la línea de demora no aparece.
5. Tocar el horario lento y, durante la carga, tocar otro horario.
   - **Esperado**: el estado de carga y el aviso pasan al segundo horario.

## 3. Accesibilidad

- Con NVDA o VoiceOver, activar el horario lento con Enter: se oye una vez "Cargando las
  butacas de las…" y, a los 5 s, la línea de demora una vez. El foco queda en el horario.
- Con `prefers-reduced-motion: reduce` emulado: nada se mueve (no hay nada que mover).
- A 360 px: el aviso se lee completo y no genera scroll horizontal.

## 4. Sin cambios

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/funciones/9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b0ff
```

Esperado: `404`, como hoy.

## 5. Pruebas automáticas

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run typecheck && npm run lint
```
