// Renders build/icon.svg to build/icon.png (512) and build/icon.ico (256, PNG-in-ICO).
// Run: npx electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const buildDir = path.join(__dirname, '..', 'build')
const svg = fs.readFileSync(path.join(buildDir, 'icon.svg'), 'utf8')

function ico(png) {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
  header.writeUInt8(0, 6); header.writeUInt8(0, 7) // 0 = 256px
  header.writeUInt8(0, 8); header.writeUInt8(0, 9)
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18)
  return Buffer.concat([header, png])
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } })
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 300))
  const img = (await win.capturePage({ x: 0, y: 0, width: 512, height: 512 })).resize({ width: 512, height: 512, quality: 'best' })
  fs.writeFileSync(path.join(buildDir, 'icon.png'), img.toPNG())
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico(img.resize({ width: 256, height: 256, quality: 'best' }).toPNG()))
  console.log('wrote build/icon.png and build/icon.ico')
  app.quit()
})
