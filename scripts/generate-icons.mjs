import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = path.join(root, 'public', 'icons')

// NEXA Call monogram paths (matching src/components/brand/logo.tsx)
const WHITE =
  'M302.773 436.409C302.848 416.226 302.811 396.042 302.662 375.859C302.598 359.909 299.401 337.994 311.37 326.226C316.706 320.984 323.926 318.109 331.404 318.25C340.97 318.486 347.748 322.735 354.132 329.506C373.982 350.557 394.39 371.079 414.328 392.04C418.945 396.885 424.251 404.534 431.263 404.765C437.235 405.05 442.668 401.389 443.234 395.034C444.435 381.537 443.695 367.487 443.71 353.861L451.68 353.794C451.846 371.401 451.884 389.009 451.796 406.616C451.765 412.674 451.599 418.828 451.603 424.885C451.613 438.217 439.399 449.284 426.32 449.174C415.531 449.028 407.97 443.43 400.758 436.03L355.458 388.654C347.88 380.624 340.468 372.145 332.268 364.725C324.705 357.883 313.308 360.118 311.421 370.877C310.103 378.779 310.603 387.754 310.616 395.796L310.728 436.284C329.251 448.085 302.671 465.305 297.477 446.673C296.458 443.015 299.883 438.538 302.773 436.409Z'
const BLUE =
  'M443.71 353.861C443.697 347.545 444.481 337.529 443.133 331.359C441.577 328.613 437.857 327.5 437.642 323.865C437.315 318.33 440.592 313.093 446.649 312.762C449.488 312.61 452.268 313.618 454.351 315.554C460.314 321.154 456.105 327.125 451.712 331.583C451.617 338.935 451.687 346.429 451.68 353.794L443.71 353.861Z'

const SRC = { x: 289, y: 305, w: 177, h: 158 }

function iconSvg({ size = 512, radius = 116, pad = 0.175 } = {}) {
  const inner = size * (1 - 2 * pad)
  const scale = inner / SRC.w
  const iw = SRC.w * scale
  const ih = SRC.h * scale
  const tx = (size - iw) / 2 - SRC.x * scale
  const ty = (size - ih) / 2 - SRC.y * scale
  const rect = `<rect width="${size}" height="${size}"${radius ? ` rx="${radius}"` : ''} fill="#111A2E"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    rect +
    `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})">` +
    `<path fill="#F3F6FC" d="${WHITE}"/>` +
    `<path fill="#4388FF" d="${BLUE}"/>` +
    `</g></svg>`
  )
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean)
  return candidates.find((p) => fs.existsSync(p))
}

const rounded = iconSvg({ size: 512, radius: 116, pad: 0.175 })
const maskable = iconSvg({ size: 512, radius: 0, pad: 0.2 })

fs.mkdirSync(iconsDir, { recursive: true })
fs.writeFileSync(path.join(root, 'public', 'favicon.svg'), rounded + '\n')
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), rounded + '\n')
console.log('wrote public/favicon.svg and public/icons/icon.svg')

const chrome = findChrome()
if (!chrome) {
  console.error('Chrome not found; skipping PNG icons (set CHROME_PATH).')
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()

async function render(svg, size, file) {
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>${sized}</body></html>`,
    { waitUntil: 'load' },
  )
  await page.screenshot({ path: file, type: 'png', omitBackground: true })
  console.log('wrote ' + path.relative(root, file))
}

await render(rounded, 512, path.join(iconsDir, 'icon-512.png'))
await render(rounded, 192, path.join(iconsDir, 'icon-192.png'))
await render(rounded, 180, path.join(iconsDir, 'apple-touch-icon.png'))
await render(maskable, 512, path.join(iconsDir, 'maskable-512.png'))

await browser.close()
