# Seguimiento de Actividades

App web para compartir por link una tabla de actividades. Cualquiera con el link puede filtrar,
ver el estatus y actualizar campos específicos de cada actividad. Cada cambio queda registrado
en una bitácora con el nombre de quién lo hizo.

## Cómo funciona

- Al abrir el link por primera vez, se pide el nombre de quien va a usar la app (se guarda en el
  navegador, sin contraseña).
- Filtros: fecha compromiso, responsable, coordinación y estatus (selección múltiple).
- Botón **Actualizar** en cada fila habilita edición solo de: Avance, Comentario,
  Fecha compromiso y Barreras/Apoyo querido. El resto de la fila no es editable.
- Al editar aparecen los botones **Guardar** / **Descartar**.
- Cada campo que cambie se guarda en la bitácora (`change_log`) con valor anterior, valor nuevo,
  quién hizo el cambio y cuándo. El botón "Ver historial" de cada fila muestra ese registro.

## Requisitos

- Node.js 22.5 o superior (usa el módulo nativo `node:sqlite`, sin dependencias de compilación).

## Uso local

```bash
npm install
npm start
```

Abre http://localhost:3000

La base de datos SQLite se crea automáticamente en `data/app.db` la primera vez que corres
el servidor, con una actividad de ejemplo.

## Desplegar en Render (para compartir por link)

El proyecto ya incluye [`render.yaml`](render.yaml) (Render "Blueprint"), listo para usarse.

1. **Sube el proyecto a GitHub.** Crea un repositorio (puede ser privado) y sube esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Primera versión de seguimiento de actividades"
   git branch -M main
   git remote add origin <URL_DE_TU_REPO_EN_GITHUB>
   git push -u origin main
   ```
2. En [render.com](https://render.com), crea una cuenta (o inicia sesión) y ve a
   **New +** → **Blueprint**.
3. Conecta tu repositorio de GitHub. Render detecta `render.yaml` automáticamente y propone:
   - Un **Web Service** (Node) que corre `npm install` y `npm start`.
   - Un **disco persistente** de 1 GB montado en `/var/data`, donde vivirá la base de datos
     SQLite (`data/app.db` vía la variable `DATA_DIR`). Esto es necesario para que los datos
     **no se borren** cada vez que Render reinicia o redespliega el servicio.
4. Confirma el despliegue. Al terminar, Render te da una URL pública
   (`https://seguimiento-actividades.onrender.com` o similar) — ese es el link que compartes.

**Sobre costos:** el plan `starter` de Render (el más económico que soporta disco persistente,
actualmente desde ~$7 USD/mes) es necesario porque el plan gratuito de Render no incluye disco
persistente — con el plan gratuito los datos se perderían en cada reinicio del servicio. Si
prefieres no pagar y solo quieres probar la interfaz sin garantía de persistencia, puedes cambiar
`plan: starter` por `plan: free` y quitar el bloque `disk` en `render.yaml`, con esa advertencia.

Cada vez que hagas `git push` a `main`, Render vuelve a desplegar automáticamente la versión
más reciente.
