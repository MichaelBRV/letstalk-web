# Instrucciones para Lovable · Let's Talk (pantallas del sistema de gestión académica)

## Qué es este proyecto

Son **solo las pantallas (front-end)** del sistema de gestión académica Let's Talk de GLED. Toda la lógica, los permisos y los datos están en una API que ya funciona en Microsoft Azure. Este proyecto no tiene back-end, base de datos ni variables secretas.

- Repositorio: `MichaelBRV/letstalk-web` (rama `main`)
- Dominio de publicación: **https://letstalk.gledcenter.com** (dominio en GoDaddy)
- API que consume: `https://func-letstalk-gled.azurewebsites.net` (ya configurada en `index.html`)

## Regla principal: no modificar el código

Publica el proyecto **tal como está en el repositorio**. No conviertas el proyecto a React, no agregues librerías, no cambies estilos, textos ni la estructura de carpetas, y no regeneres archivos.

Los cambios se hacen fuera de Lovable y llegan por GitHub. Cuando el repositorio cambie, solo vuelve a publicar la última versión de `main`.

## Tecnología

- Proyecto **Vite 5** con HTML, CSS y JavaScript (módulos ES). **No usa React ni TypeScript.**
- Las pantallas ya están listas en `public/`: Vite solo las copia a `dist/`.
- Instalación: `npm install`
- Compilación: `npm run build`, que genera la carpeta `dist/` (es lo que se publica).
- Vista local: `npm run dev`

## Estructura

```
index.html          página única; trae la dirección de la API y la política de seguridad (CSP)
vite.config.js      configuración mínima (no tocar)
public/
  css/app.css       estilos (colores de Let's Talk)
  js/               módulos de la aplicación (app.js es el punto de entrada)
  img/              logo, favicon y fondos del certificado oficial GLED
```

## Configuración de la publicación

1. **Dominio:** conecta `letstalk.gledcenter.com` con el conector de GoDaddy y deja HTTPS activo.
2. **Rutas:** la aplicación navega con `#` (por ejemplo `/#/grupos`), así que no necesita reglas de redirección de rutas. Basta con servir `index.html` en `/`.
3. **No cambiar `index.html`**. Contiene tres cosas que deben quedar exactamente igual:
   - `<meta name="lt-api" ...>`: la dirección de la API.
   - `<meta http-equiv="Content-Security-Policy" ...>`: solo permite conectarse a la API y a `login.microsoftonline.com` (inicio de sesión con Microsoft).
   - `<script type="module" src="/js/app.js">`: el punto de entrada.
4. **Sin variables de entorno.** El proyecto no las necesita.

## Restricciones que son intencionales (no son errores)

- **Solo funciona desde `https://letstalk.gledcenter.com`.** La API rechaza peticiones de cualquier otro dominio, incluida la vista previa de Lovable: ahí el login mostrará "Origen no permitido". Para probar en la vista previa, hay que pedir a sistemas@gledcenter.com que agregue esa dirección a los orígenes permitidos de la API.
- **"Iniciar sesión con Microsoft"** solo funciona en `https://letstalk.gledcenter.com/` (y en `http://localhost:3000/` para desarrollo), porque son las únicas direcciones registradas en Microsoft Entra ID.
- **Primera carga del día:** si nadie usó el sistema por un rato, la primera petición puede tardar hasta un minuto mientras la base de datos se activa. La pantalla muestra el aviso "Conectando con el servidor…".

## Cómo verificar que quedó bien publicado

1. Abre `https://letstalk.gledcenter.com`: debe verse la pantalla de inicio de sesión con el logo de let's talk y el botón "Iniciar sesión con Microsoft".
2. Al ingresar con una cuenta de GLED, el sistema pide cambiar la contraseña genérica en el primer acceso.
3. En la consola del navegador no debe haber errores de "Content Security Policy" ni de "CORS".

## Contacto

Cualquier cambio de pantallas, colores, textos o funciones se solicita a **sistemas@gledcenter.com**. Se hace en el proyecto principal y llega a este repositorio.
