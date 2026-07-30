# MEL Flyer V1

Aplicación Next.js para generar flyers de MEL Propiedades.

## Funciones incluidas
- Selección de corredor.
- Extracción de datos desde un enlace de Portal Inmobiliario.
- Campos editables.
- Carga de fotografías.
- Selección de portada y atributo destacado con OpenAI.
- Retoque inmobiliario de hasta cuatro fotografías con OpenAI.
- Generación de PDF.

## Publicación en GitHub sin scripts
1. Abre Terminal en tu Mac.
2. Escribe `cd `, arrastra esta carpeta a la ventana de Terminal y presiona Enter.
3. Copia y pega el bloque siguiente:

```bash
git init
git branch -M main
git remote add origin https://github.com/carlafucito/mel-flyer.git
git add .
git commit -m "MEL Flyer V1"
git push -u origin main
```

Si GitHub pide autorización, completa el inicio de sesión en el navegador.

## Vercel
1. Importa `carlafucito/mel-flyer`.
2. Agrega la variable privada `OPENAI_API_KEY` en Production, Preview y Development.
3. Despliega nuevamente después de guardar la variable.

La clave nunca debe guardarse en el repositorio.
