# Nuestro Universo — Experiencia Web Romántica

Experiencia web interactiva y responsive (prioridad móvil y compatible con escritorio) con estética espacial/galaxia, glassmorphism e inspiración Avengers, creada con HTML, CSS y JavaScript puro sin dependencias externas.

## Estructura del proyecto

```text
M-AVENGER/
├── index.html
├── sync-tool.html      # Herramienta manual de sincronización LRC (entorno dev)
├── README.md
├── .gitignore
├── css/
│   ├── animations.css
│   ├── styles.css
│   └── sync-tool.css
├── js/
│   ├── app.js          # Flujo de pantallas y validación de login
│   ├── assets.js       # Resolución de recursos locales
│   ├── config.js       # Textos, canción y carta final editable
│   ├── lrcParser.js    # Parser de marcas de tiempo .lrc
│   ├── player.js       # Reproductor de audio y sincronización karaoke
│   └── syncTool.js     # Controlador del sincronizador manual LRC
├── img/
│   ├── avengers-equipo.png.png
│   ├── fondo-login.png
│   ├── panda-corazon.png.png
│   └── portada-cancion.jpg
├── letra/
│   └── letra.lrc.txt
└── musica/
    └── cancion.mp3.mp3
```

> Nota: El cargador de recursos (`js/assets.js`) detecta automáticamente los archivos actuales del repositorio y también soporta nombres con extensión simple (`avengers-equipo.png`, `panda-corazon.png`, `cancion.mp3`, `letra.lrc`) en caso de renombrarlos.

## Cómo ejecutarlo localmente

Debido a que la aplicación usa módulos ES (`type="module"`) y lectura local del archivo `.lrc` mediante `fetch()`, debe abrirse mediante un servidor HTTP local (no directamente con doble clic como `file://`):

### Opción 1: Python
```bash
python -m http.server 8000
```
Luego abre `http://localhost:8000` en tu navegador.

### Opción 2: Node.js
```bash
npx serve .
```

### Opción 3: VS Code
Usa la extensión **Live Server** sobre `index.html`.

## Personalización rápida

- **Carta final, títulos y textos:** edita `js/config.js`.
- **Contraseña de acceso:** `18.01.2005` (configurable en `APP_CONFIG.accessCode` dentro de `js/config.js`).
- **Letra sincronizada:** abre `http://localhost:8000/sync-tool.html` mientras corre el servidor local, reproduce la canción y marca cada frase con **Espacio** / **Enter**; luego descarga o copia el `.lrc` generado dentro de `letra/letra.lrc.txt` (o `letra/letra.lrc`).

## Publicar en GitHub Pages

Todas las rutas son relativas (`css/`, `js/`, `img/`, `musica/`, `letra/`), por lo que funciona directamente bajo subrutas como `https://proyectos-name.github.io/nuestro-universo/`.

1. Sube el repositorio a GitHub.
2. Ve a **Settings → Pages**.
3. Selecciona la rama principal (`main`) y la carpeta raíz (`/root`).
4. Guarda y abre la URL generada por GitHub Pages.
