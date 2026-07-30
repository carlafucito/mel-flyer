# PRD — MEL Flyer

Última actualización: 2026-07-30

## Objetivo

Crear una PWA móvil para MEL Propiedades que permita generar un flyer profesional en menos de 3 minutos. El desarrollo se realizará en fases; este documento recoge requisitos, alcance de la Fase 1 y criterios de aceptación.

## Alcance general

- Aplicación Next.js 15 con App Router y TypeScript.
- PWA instalable (manifest, service worker).
- UI mobile-first para generar flyers inmobiliarios a partir de un aviso de Portal Inmobiliario.
- Uso de OpenAI e imágenes en fases posteriores (no en Fase 1).

## Fase 1 — Pantalla principal (entregable inmediato)

Requerimientos funcionales:

1. Pantalla única, mobile-first, con el siguiente orden visual:
   - Logo MEL Propiedades centrado arriba.
   - Título: "Generador de Flyers".
   - Subtítulo: "MEL Propiedades".
   - Selector de corredor (lista exacta abajo).
   - Teléfono del corredor seleccionado visible y asociado automáticamente.
   - Campo grande para pegar URL con placeholder `https://www.portalinmobiliario.com/...`.
   - Botón rojo con texto "Extraer información".

2. Lista de corredores (mostrar nombre y asociar teléfono automáticamente):
   - Carla Fucito — +56 9 7558 2708
   - Francisca Alarcón — +56 9 5416 4474
   - Soledad Velasco — +56 9 9736 4205
   - Verónica Vergara — +56 9 7675 8419
   - Francisco Monti — +56 9 5914 4757
   - Rodrigo Lama — +56 9 7792 5335
   - Francisca Parada — +56 9 9320 7474

3. Comportamiento del botón "Extraer información":
   - En Fase 1 solo valida que la URL pegada es una URL válida (sintaxis).
   - Si inválida, muestra mensaje de error inline.
   - Si válida, guarda en memoria local (estado React) los siguientes datos: `broker` (nombre), `phone` (teléfono) y `url`.
   - No se debe intentar extraer datos del portal en esta fase.

4. Restricciones explícitas para Fase 1:
   - No implementar extracción automática (scraping) ni llamadas a APIs externas.
   - No usar OpenAI ni generación de PDF.
   - No añadir base de datos ni persistencia en servidor.
   - No inventar funcionalidades: implementar exactamente lo descrito.

## Componentes y estructura propuesta

- `app/page.tsx` — Pantalla principal mobile-first.
- `components/BrokerSelect.tsx` — Selector reutilizable de corredores.
- `components/InputField.tsx` — Campo URL reutilizable.
- `components/PrimaryButton.tsx` — Botón primario reutilizable.
- `public/mel-logo.jpg` — Logo.

## Criterios de aceptación (Fase 1)

- UI responsive mobile-first, coincidente con el orden y texto solicitados.
- Al seleccionar corredor, el teléfono mostrado se actualiza correctamente.
- El placeholder del campo URL coincide con `https://www.portalinmobiliario.com/...`.
- Al pulsar "Extraer información":
  - Se valida la URL sintácticamente.
  - En caso válido, se guarda en memoria y se muestra confirmación.
  - En caso inválido, se muestra mensaje de error.
- Proyecto compila con `npm run build` sin errores.
- Código organizado en componentes reutilizables y listo para extender.

## Variables de entorno y despliegue

- En Fase 1 **no** se requieren variables de entorno.
- Para fases posteriores (análisis, mejora de imágenes) se utilizará:
  - `OPENAI_API_KEY` (solo en Vercel/environment server-side). Nunca exponer en cliente.

## Pasos para reproducir localmente

1. Clonar repo y entrar en carpeta.
2. Instalar dependencias:

```bash
npm install
```

3. Ejecutar build para comprobar compilación:

```bash
npm run build
```

4. Ejecutar en modo desarrollo:

```bash
npm run dev
```

## Notas de implementación y futuras fases

- Mantener la UI y la estructura preparada para añadir en Fase 2:
  - Llamada a `/api/extract` para scraping/parseo de Portal Inmobiliario.
  - Vista de edición de campos extraídos y subida de fotos.
  - Análisis y mejora de imágenes vía OpenAI.
  - Generación de PDF y compatibilidad Web Share API.

- No introducir cambios de flujo ni almacenamiento exterior sin RFC previo.

## Responsables y entregables

- Responsable de la implementación inicial: equipo de desarrollo MEL.
- Entregable Fase 1: merge de `feat(ui): mobile-first main screen with broker selector and URL validation (phase 1)` a `main` con `npm run build` exitoso.

***
Documento preparado según especificaciones del cliente (Fase 1). Para cambios o aprobación, indicar siguiente acción.
