// Gera build/icon.png (512) e build/icon.ico (16–256) a partir de build/icon.svg.
// Usa o próprio Electron para rasterizar o SVG: npm run icons
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const raiz = path.resolve(__dirname, '..')
const pastaBuild = path.join(raiz, 'build')
const tamanhosIco = [16, 24, 32, 48, 64, 128, 256]

async function rasterizar(svgUri, tamanho) {
  const janela = new BrowserWindow({ show: false, width: tamanho, height: tamanho, useContentSize: true, transparent: true, frame: false, webPreferences: { offscreen: true } })
  const html = `<html><body style="margin:0;background:transparent"><img src="${svgUri}" width="${tamanho}" height="${tamanho}" style="display:block"></body></html>`
  await janela.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((resolve) => setTimeout(resolve, 300))
  const imagem = await janela.webContents.capturePage({ x: 0, y: 0, width: tamanho, height: tamanho })
  janela.destroy()
  return imagem
}

// ICO com imagens PNG embutidas (suportado desde o Windows Vista).
function montarIco(imagens) {
  const cabecalho = Buffer.alloc(6)
  cabecalho.writeUInt16LE(1, 2)
  cabecalho.writeUInt16LE(imagens.length, 4)
  let deslocamento = 6 + 16 * imagens.length
  const entradas = imagens.map(({ tamanho, png }) => {
    const entrada = Buffer.alloc(16)
    entrada.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0)
    entrada.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1)
    entrada.writeUInt16LE(1, 4)
    entrada.writeUInt16LE(32, 6)
    entrada.writeUInt32LE(png.length, 8)
    entrada.writeUInt32LE(deslocamento, 12)
    deslocamento += png.length
    return entrada
  })
  return Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.png)])
}

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(pastaBuild, 'icon.svg'), 'utf8')
  const svgUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
  // Janelas muito pequenas falham no Windows: renderiza uma vez em 512 e reduz.
  const base = await rasterizar(svgUri, 512)
  fs.writeFileSync(path.join(pastaBuild, 'icon.png'), base.toPNG())
  const imagens = tamanhosIco.map((tamanho) => ({ tamanho, png: base.resize({ width: tamanho, height: tamanho, quality: 'best' }).toPNG() }))
  fs.writeFileSync(path.join(pastaBuild, 'icon.ico'), montarIco(imagens))
  console.log('Ícones gerados em build/')
  app.quit()
})
