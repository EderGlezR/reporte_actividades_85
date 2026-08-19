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

- Node.js 18 o superior.
- Una base de datos Postgres (local o remota) — la app la usa para persistir actividades y la
  bitácora de cambios.

## Uso local

1. Copia la cadena de conexión de tu base de datos Postgres (local o la que uses en Render) y
   defínela como variable de entorno `DATABASE_URL`:

   ```bash
   # PowerShell
   $env:DATABASE_URL = "postgres://usuario:password@host:5432/basededatos"

   # bash
   export DATABASE_URL="postgres://usuario:password@host:5432/basededatos"
   ```

   Si tu Postgres local no usa SSL, agrega también `PGSSL=disable`.

2. Instala dependencias y arranca el servidor:

   ```bash
   npm install
   npm start
   ```

Abre http://localhost:3000. Las tablas (`activities`, `change_log`) y la actividad de ejemplo se
crean automáticamente la primera vez que el servidor se conecta a la base de datos.

## Desplegar en Render (para compartir por link)

El proyecto ya incluye [`render.yaml`](render.yaml) (Render "Blueprint"), listo para usarse.
Define dos recursos: el **Web Service** de Node y una **base de datos Postgres** (plan free),
conectados automáticamente vía la variable `DATABASE_URL`.

1. **Sube el proyecto a GitHub** (si aún no lo has hecho):
   ```bash
   git add .
   git commit -m "Migrar a Postgres"
   git push origin main
   ```
2. En [render.com](https://render.com), crea una cuenta (o inicia sesión) y ve a
   **New +** → **Blueprint**.
3. Conecta tu repositorio de GitHub. Render detecta `render.yaml` automáticamente y propone crear
   el Web Service y la base de datos Postgres, ambos en plan **free** (sin pedir tarjeta).
4. Confirma el despliegue. Al terminar, Render te da una URL pública
   (`https://seguimiento-actividades.onrender.com` o similar) — ese es el link que compartes.

Cada vez que hagas `git push` a `main`, Render vuelve a desplegar automáticamente la versión
más reciente. La base de datos Postgres vive **separada** del servicio web, así que sobrevive
redeploys y reinicios del contenedor: los datos ya no se pierden como pasaba con SQLite en el
disco temporal.

**⚠️ Dos límites del plan free que sí siguen aplicando:**
- El **Web Service** se duerme tras ~15 minutos sin tráfico; la primera visita después de eso
  tarda 30-50 segundos en responder mientras arranca de nuevo. Los datos no se pierden por esto,
  solo hay una espera inicial.
- La **base de datos Postgres free de Render expira a los 90 días** y hay que recrearla (o pasar
  a un plan pagado) para no perder la información acumulada. Si esto pasa a ser una herramienta
  de uso continuo, conviene poner un recordatorio para revisarlo antes de esa fecha, o migrar a
  un proveedor de Postgres gratuito sin expiración (como Neon) o al plan pagado de Render.
