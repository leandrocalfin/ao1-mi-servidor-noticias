# Sistema de Publicación de Noticias — Node.js

**Actividad Obligatoria N.° 1 — Programación de Aplicaciones Web II**  
**Alumno/a:** Juan Leandro Calfin Tejada 
**Enlace al repositorio:** https://github.com/leandrocalfin/ao1-mi-servidor-noticias

## Descripción general

Servidor web desarrollado con Node.js (sin frameworks) que permite gestionar un sistema simple de publicación de noticias breves. El servidor sirve archivos estáticos, procesa formularios HTML mediante POST, responde a parámetros GET y persiste los datos en un archivo de texto.

# Punto 1 — Diagrama de Flujo

El diagrama de flujo se encuentran en la carpeta `/docs` del repositorio, se adjunta link del editable compartido en drive:

- `docs/flujo_general.png` — Diagrama general del servidor
- https://drive.google.com/file/d/1-k2MvHatlLWVpVEcWNpd9pqYQmaInXQZ/view?usp=sharing - Enlace al diagrama editable (Drawio)

# Punto 1 - Lógica general del servidor

El servidor recibe cada petición HTTP, construye el camino del recurso solicitado (`'public' + pathname`) y lo evalúa en un `switch`. Según la ruta, ejecuta una de estas acciones:

- `/` o `/index.html` → genera dinámicamente el listado de noticias
- `/noticia?id=N` → muestra el detalle de una noticia por su número
- `/publicar` (POST) → captura los datos del formulario y los guarda en `noticias.txt`
- Cualquier otra ruta → intenta servir el archivo estático con caché

En todos los casos se manejan los códigos HTTP 200, 404 y 500 según corresponda.

## Punto 2 — Arquitectura y Selección de Librerías

## 2.A — Módulos nativos de Node.js

**(http) Es el módulo central del servidor. Permite crear un servidor web que escucha peticiones HTTP y envía respuestas.**

- `http.createServer((pedido, respuesta) => {...})`: crea el servidor y define la función que se ejecuta cada vez que llega una petición. 
   Los objetos `pedido` y `respuesta` contienen toda la información de la comunicación.

- `servidor.listen(8888)` — pone al servidor a escuchar peticiones en el puerto 8888.

- `respuesta.writeHead(200, { 'Content-Type': 'text/html' })` — escribe la cabecera HTTP con el código de estado y el tipo de contenido.

- `respuesta.write(contenido)` — escribe el cuerpo de la respuesta.

- `respuesta.end()` — finaliza la respuesta y la envía al cliente.

Se eligió este módulo porque es el núcleo de cualquier servidor HTTP en Node.js y está disponible sin necesidad de instalación.

**(fs - File System): Permite interactuar con el sistema de archivos: leer, escribir y verificar la existencia de archivos.**

- `fs.stat(camino, callback)` — verifica si un archivo existe antes de intentar leerlo. Si no existe, el parámetro `error` del callback tendrá un valor distinto de `null`.

- `fs.readFile(camino, callback)` — lee el contenido completo de un archivo de forma asincrónica. El contenido llega como un objeto `Buffer` que se convierte a texto con `.toString()`.

- `fs.appendFile(archivo, datos, callback)` — agrega texto al final de un archivo. Si el archivo no existe, lo crea. Se usa para persistir las noticias en `noticias.txt`.

Se eligió la versión con callbacks (en lugar de `fs/promises`) porque es la forma que se trabaja en la asignatura y resulta más explícita para entender el modelo asincrónico.

**(url -clase URL)**
Permite parsear y descomponer la URL de cada petición en sus partes.

- `new URL('http://localhost:8888' + pedido.url)` — construye un objeto URL a partir del string de la petición, lo que permite acceder a sus partes de forma ordenada.

- `url.pathname` — devuelve solo la ruta del recurso, sin los parámetros. Por ejemplo, de `http://localhost:8888/noticia?id=2` extrae `/noticia`.

- `url.searchParams.get('id')` — devuelve el valor del parámetro `id` de la query string. Se usa para obtener el número de noticia en la ruta GET `/noticia?id=N`.

Se eligió este módulo porque simplifica enormemente el trabajo con URLs, evitando tener que parsear los strings manualmente.


## 2B— Paquetes de npm

**mime (versión 3.x)**

Instalación:
```bash
npm install mime@3
```

El paquete `mime` resuelve el tipo MIME de un archivo a partir de su extensión. Esto es necesario para informar al navegador qué tipo de contenido está recibiendo (HTML, CSS, imagen, etc.) a través del header `Content-Type`.

**Método principal utilizado:**
javascript
mime.getType(camino)

Recibe un string con el nombre o ruta del archivo y devuelve el tipo MIME correspondiente. Por ejemplo:
- `mime.getType('estilos.css')` → `'text/css'`
- `mime.getType('foto.jpg')` → `'image/jpeg'`
- `mime.getType('index.html')` → `'text/html'`

Se eligió este paquete en lugar de definir un objeto literal con los tipos MIME manualmente (como se vio en la Unidad 2) porque cubre todos los formatos posibles sin necesidad de agregarlos uno a uno. Se instaló la versión 3.x porque la versión 4.x cambió a módulos ESM y no es compatible con `require()`.


### Punto 3 — Explicación de la Implementación

**Bloque A — Servidor HTTP y routing**

El servidor se crea con `http.createServer()`, que recibe una función anónima con dos parámetros: `pedido` (la petición del navegador) y `respuesta` (lo que el servidor va a devolver). Esta función se ejecuta cada vez que llega una nueva petición, de forma asincrónica.

Dentro de esa función se construye el camino del recurso:

```javascript
const url = new URL('http://localhost:8888' + pedido.url)
let camino = 'public' + url.pathname
```

Si el usuario pidió la raíz del sitio (`/`), `camino` quedaría como `'public/'`, que no es un archivo real. Por eso se corrige manualmente:

```javascript
if (camino == 'public/')
  camino = 'public/index.html'
```

Luego se llama a la función `encaminar()`, que usa un `switch` para decidir qué hacer según el valor de `camino`. Si coincide con una ruta dinámica (`public/index.html`, `public/publicar`, `public/noticia`) se llama a la función correspondiente. Si no coincide con ninguna, el `default` intenta servir el archivo como recurso estático.

---

**Bloque B — Servicio de archivos estáticos con caché**

Para evitar leer del disco en cada petición, se implementa un sistema de caché en memoria usando un objeto vacío:

```javascript
const cache = {}
```

Cuando llega una petición de archivo estático, primero se verifica si ya está en la caché:

```javascript
if (cache[camino]) {
  // servir desde memoria
}
```

Si está, se sirve directamente sin tocar el disco. Si no está, se lee con `fs.stat()` (para verificar que existe) y luego con `fs.readFile()`. Una vez leído, se guarda en la caché:

```javascript
cache[camino] = contenido
```

Para determinar el `Content-Type` se usa el paquete `mime`:

```javascript
const mimearchivo = mime.getType(camino) || 'text/plain'
respuesta.writeHead(200, { 'Content-Type': mimearchivo })
```

Esto permite que el navegador interprete correctamente cada recurso, ya sea HTML, CSS, imagen u otro formato.

---

**Bloque C — Captura de datos POST**

Cuando el usuario completa el formulario y presiona "Publicar", el navegador envía los datos al servidor mediante el método POST. En Node.js, estos datos no llegan de una sola vez sino en partes llamadas **chunks**, porque el protocolo HTTP puede dividir el cuerpo de la petición en múltiples fragmentos.

Para capturarlos se usan dos eventos del objeto `pedido`:

```javascript
let info = ''

pedido.on('data', datosParciales => {
  info += datosParciales
})

pedido.on('end', () => {
  // todos los datos llegaron
})
```

El evento `data` se dispara cada vez que llega un chunk, y se va concatenando en la variable `info`. El evento `end` se dispara cuando terminaron de llegar todos los chunks.

Una vez ensamblados todos los datos, `info` contiene un string con el formato:
```
titulo=Mi+noticia&cuerpo=El+contenido+de+la+noticia
```

Para acceder a cada campo por su nombre se usa `URLSearchParams`:

```javascript
const formulario = new URLSearchParams(info)
formulario.get('titulo')  // devuelve el título ingresado
formulario.get('cuerpo')  // devuelve el cuerpo ingresado
```

---

**Bloque D — Parámetros GET**

Cuando el usuario hace click en "Ver detalle" de una noticia, el navegador hace una petición a `/noticia?id=3` (por ejemplo). El número de noticia viaja como parámetro en la URL.

Para recuperarlo se usa el objeto `url` construido con la clase `URL`:

```javascript
const id = parseInt(url.searchParams.get('id'))
```

`searchParams.get('id')` devuelve el valor del parámetro `id` como string, y `parseInt()` lo convierte a número entero para poder usarlo como índice.

Luego se valida que el id sea un número válido y que esté dentro del rango de noticias existentes:

```javascript
if (!id || id < 1 || id > noticias.length) {
  respuesta.writeHead(404, { 'Content-Type': 'text/html' })
  respuesta.end('<h1>Noticia no encontrada</h1>')
  return
}
```

Si es válido, se muestra el contenido de esa noticia generando una página HTML dinámica en el servidor.

---

**Bloque E — Persistencia en archivo de texto**

Las noticias se guardan en el archivo `public/noticias.txt`. Cada noticia se almacena con el siguiente formato:

```
titulo:Mi noticia
cuerpo:El contenido de la noticia
fecha:20/4/2026
---
```

El separador `---` permite dividir el archivo en noticias individuales al momento de leerlo.

Para agregar una nueva noticia se usa `fs.appendFile()`, que añade texto al final del archivo sin borrar el contenido existente:

```javascript
fs.appendFile('public/noticias.txt', nuevaNoticia, error => {
  if (error) {
    respuesta.writeHead(500, { 'Content-Type': 'text/plain' })
    respuesta.end('Error al guardar la noticia')
  }
})
```

Para mostrar el listado se usa `fs.readFile()`, que lee todo el archivo y luego se divide por el separador `---`:

```javascript
fs.readFile('public/noticias.txt', (error, datos) => {
  const noticias = datos.toString().split('---').filter(n => n.trim() !== '')
  // generar HTML con cada noticia
})
```

Ambas operaciones son asincrónicas: el servidor no se detiene mientras lee o escribe el archivo, sino que continúa procesando otras peticiones y ejecuta el callback cuando la operación termina.

---

# Punto 4: Estructura del repositorio

```
AO1/
├── docs/
│   ├── flujo_general.png
├── node_modules/
├── public/
│   ├── estilos.css
│   ├── formulario.html
│   ├── index.html
│   ├── noticias.txt
├── package-lock.json
├── package.json
├── README.md
└── servidor.js
```

## Cómo ejecutar

```bash
npm install mime@3
node servidor.js
```

Luego abrir en el navegador: `http://localhost:8888`
