const http = require('http')
const fs = require('fs')
const mime = require('mime')

// cache en memoria para archivos estáticos
const cache = {}

// crear servidor
const servidor = http.createServer((pedido, respuesta) => {
  const url = new URL('http://localhost:8888' + pedido.url)

  let camino = 'public' + url.pathname

  if (camino == 'public/')
    camino = 'public/index.html'

  encaminar(pedido, respuesta, camino, url)
})

servidor.listen(8888)
console.log('Servidor web iniciado')

// ------------------------------------------------------

function encaminar(pedido, respuesta, camino, url) {
  console.log(camino)

  switch (camino) {

    case 'public/index.html': {
      mostrarListado(respuesta)
      break
    }

    case 'public/publicar': {
      guardarNoticia(pedido, respuesta)
      break
    }

    case 'public/noticia': {
      mostrarNoticia(respuesta, url)
      break
    }

    default: {
      servirArchivoEstatico(respuesta, camino)
    }
  }
}

// ------------------------------------------------------
// LISTADO DE NOTICIAS (ruta raíz / index.html)
// ------------------------------------------------------

function mostrarListado(respuesta) {
  fs.readFile('public/noticias.txt', (error, datos) => {
    let contenidoHtml = ''

    if (error || !datos || datos.toString().trim() === '') {
      contenidoHtml = '<p>No hay noticias publicadas todavía.</p>'
    } else {
      // cada noticia está separada por "---"
      const noticias = datos.toString().split('---').filter(n => n.trim() !== '')

      noticias.forEach((noticia, indice) => {
        const lineas = noticia.trim().split('\n')
        const titulo = lineas[0] ? lineas[0].replace('titulo:', '').trim() : 'Sin título'
        contenidoHtml += `
          <div class="noticia">
            <h2>${titulo}</h2>
            <a href="/noticia?id=${indice + 1}">Ver detalle</a>
          </div>
        `
      })
    }

    const pagina = `
      <!doctype html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Noticias</title>
        <link rel="stylesheet" href="estilos.css">
      </head>
      <body>
        <h1>Listado de noticias</h1>
        ${contenidoHtml}
        <br>
        <a href="formulario.html">Publicar nueva noticia</a>
      </body>
      </html>
    `

    respuesta.writeHead(200, { 'Content-Type': 'text/html' })
    respuesta.end(pagina)
  })
}

// ------------------------------------------------------
// DETALLE DE NOTICIA (GET /noticia?id=N)
// ------------------------------------------------------

function mostrarNoticia(respuesta, url) {
  const id = parseInt(url.searchParams.get('id'))

  fs.readFile('public/noticias.txt', (error, datos) => {
    if (error || !datos) {
      respuesta.writeHead(404, { 'Content-Type': 'text/html' })
      respuesta.end('<h1>No se encontraron noticias</h1>')
      return
    }

    const noticias = datos.toString().split('---').filter(n => n.trim() !== '')

    if (!id || id < 1 || id > noticias.length) {
      respuesta.writeHead(404, { 'Content-Type': 'text/html' })
      respuesta.end('<h1>Noticia no encontrada</h1>')
      return
    }

    const noticia = noticias[id - 1].trim()
    const lineas = noticia.split('\n')
    const titulo = lineas[0] ? lineas[0].replace('titulo:', '').trim() : 'Sin título'
    const cuerpo = lineas[1] ? lineas[1].replace('cuerpo:', '').trim() : 'Sin contenido'
    const fecha = lineas[2] ? lineas[2].replace('fecha:', '').trim() : 'Sin fecha'

    const pagina = `
      <!doctype html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${titulo}</title>
        <link rel="stylesheet" href="estilos.css">
      </head>
      <body>
        <h1>${titulo}</h1>
        <p>${cuerpo}</p>
        <small>Publicado: ${fecha}</small>
        <br><br>
        <a href="/">Volver al listado</a>
      </body>
      </html>
    `

    respuesta.writeHead(200, { 'Content-Type': 'text/html' })
    respuesta.end(pagina)
  })
}

// ------------------------------------------------------
// GUARDAR NOTICIA (POST /publicar)
// ------------------------------------------------------

function guardarNoticia(pedido, respuesta) {
  let info = ''

  pedido.on('data', datosParciales => {
    info += datosParciales
  })

  pedido.on('end', () => {
    const formulario = new URLSearchParams(info)
    const titulo = formulario.get('titulo')
    const cuerpo = formulario.get('cuerpo')
    const fecha = new Date().toLocaleDateString('es-AR')

    const nuevaNoticia = `titulo:${titulo}\ncuerpo:${cuerpo}\nfecha:${fecha}\n---\n`

    fs.appendFile('public/noticias.txt', nuevaNoticia, error => {
      if (error) {
        respuesta.writeHead(500, { 'Content-Type': 'text/plain' })
        respuesta.end('Error al guardar la noticia')
        return
      }

      const pagina = `
        <!doctype html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Noticia publicada</title>
          <link rel="stylesheet" href="estilos.css">
        </head>
        <body>
          <h1>¡Noticia publicada!</h1>
          <p>Título: ${titulo}</p>
          <p>Contenido: ${cuerpo}</p>
          <a href="/">Volver al listado</a>
        </body>
        </html>
      `

      respuesta.writeHead(200, { 'Content-Type': 'text/html' })
      respuesta.end(pagina)
    })
  })
}

// ------------------------------------------------------
// SERVIR ARCHIVOS ESTÁTICOS CON CACHÉ
// ------------------------------------------------------

function servirArchivoEstatico(respuesta, camino) {

  // verificar si ya está en cache
  if (cache[camino]) {
    console.log('Recurso recuperado del cache: ' + camino)
    const mimearchivo = mime.getType(camino) || 'text/plain'
    respuesta.writeHead(200, { 'Content-Type': mimearchivo })
    respuesta.write(cache[camino])
    respuesta.end()
    return
  }

  // si no está en cache, leer del disco
  fs.stat(camino, error => {
    if (!error) {
      fs.readFile(camino, (error, contenido) => {
        if (error) {
          respuesta.writeHead(500, { 'Content-Type': 'text/plain' })
          respuesta.write('Error interno')
          respuesta.end()
        } else {
          // guardar en cache para próximas peticiones
          cache[camino] = contenido
          console.log('Recurso leído del disco: ' + camino)

          const mimearchivo = mime.getType(camino) || 'text/plain'
          respuesta.writeHead(200, { 'Content-Type': mimearchivo })
          respuesta.write(contenido)
          respuesta.end()
        }
      })
    } else {
      respuesta.writeHead(404, { 'Content-Type': 'text/html' })
      respuesta.write('<!doctype html><html><body><h1>Recurso inexistente</h1></body></html>')
      respuesta.end()
    }
  })
}