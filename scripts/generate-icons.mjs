import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BUILD_DIR = resolve(ROOT, 'build')
const RES_DIR = resolve(ROOT, 'resources')

mkdirSync(BUILD_DIR, { recursive: true })
mkdirSync(RES_DIR, { recursive: true })

// --- CRC32 for PNG chunks ---
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0 // filter type None
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride)
  }

  const compressed = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// --- Math helpers for SDF Liquid Glass Icon Rendering ---
function clamp(v, lo = 0, hi = 1) {
  return v < lo ? lo : v > hi ? hi : v
}

function mix(a, b, t) {
  return a + (b - a) * t
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  const outDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inDist = Math.min(Math.max(qx, qy), 0)
  return outDist + inDist - r
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax
  const pay = py - ay
  const bax = bx - ax
  const bay = by - ay
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay))
  return Math.hypot(pax - bax * h, pay - bay * h)
}

function blendOver(dst, srcR, srcG, srcB, srcA) {
  const a = clamp(srcA)
  if (a <= 0) return
  const outA = a + dst.a * (1 - a)
  if (outA <= 0) return
  dst.r = (srcR * a + dst.r * dst.a * (1 - a)) / outA
  dst.g = (srcG * a + dst.g * dst.a * (1 - a)) / outA
  dst.b = (srcB * a + dst.b * dst.a * (1 - a)) / outA
  dst.a = outA
}

/**
 * Renders the WorkPacer Liquid Glass emblem in normalized [-1, 1] coordinates.
 */
function sampleWorkPacerPixel(nx, ny, pixelScale) {
  const out = { r: 0, g: 0, b: 0, a: 0 }
  const aa = pixelScale * 1.35

  // 1. Rounded Liquid Glass Squircle Tile
  const half = 0.88
  const cornerR = 0.42
  const dBox = sdRoundedBox(nx, ny, half, half, cornerR)
  const boxAlpha = 1 - smoothstep(-aa, aa, dBox)
  if (boxAlpha <= 0.001) return out

  // Multi-stop Liquid Glass gradient: Sky Cyan (#0ea5e9) -> Emerald Teal (#0d9488) -> Deep Indigo (#4338ca)
  const diag = clamp((nx + ny + 1.76) / 3.52)
  let baseR, baseG, baseB
  if (diag < 0.5) {
    const t = diag * 2
    baseR = mix(14, 13, t)
    baseG = mix(165, 148, t)
    baseB = mix(233, 136, t)
  } else {
    const t = (diag - 0.5) * 2
    baseR = mix(13, 55, t)
    baseG = mix(148, 65, t)
    baseB = mix(136, 198, t)
  }

  // Ambient cyan glow near top-left
  const glowDist = Math.hypot(nx + 0.36, ny + 0.42)
  const glow = clamp(1 - glowDist / 1.15) * 0.35
  baseR = clamp(baseR + glow * 110, 0, 255)
  baseG = clamp(baseG + glow * 95, 0, 255)
  baseB = clamp(baseB + glow * 65, 0, 255)

  blendOver(out, baseR, baseG, baseB, boxAlpha)

  // Top glass sheen reflection (Liquid Glass specular dome)
  const domeDist = Math.hypot(nx * 0.85, ny + 0.92)
  const domeMask = (1 - smoothstep(0.72, 0.82, domeDist)) * clamp((-ny + 0.15) * 1.1)
  if (domeMask > 0) {
    blendOver(out, 255, 255, 255, domeMask * 0.22 * boxAlpha)
  }

  // Specular rim border inside squircle
  const rimThickness = Math.max(0.032, pixelScale * 1.4)
  const rimAlpha =
    (1 - smoothstep(-aa, aa, Math.abs(dBox + rimThickness * 0.5) - rimThickness * 0.5)) *
    mix(0.62, 0.18, clamp((ny + 0.88) / 1.76))
  blendOver(out, 255, 255, 255, rimAlpha * boxAlpha)

  // 2. Inner Frosted Dial Ring
  const r = Math.hypot(nx, ny)
  const dialRadius = 0.54
  const ringHalfW = Math.max(0.062, pixelScale * 1.6)
  const dRing = Math.abs(r - dialRadius) - ringHalfW
  const trackAlpha = (1 - smoothstep(-aa, aa, dRing)) * 0.28 * boxAlpha
  blendOver(out, 255, 255, 255, trackAlpha)

  // Active Pace Arc (from -135 deg clockwise to +105 deg)
  const angle = Math.atan2(ny, nx) // -PI..PI (0 is East, -PI/2 is North)
  const deg = (angle * 180) / Math.PI
  // Normalize relative to start = -140 deg
  const relDeg = ((deg + 140) % 360 + 360) % 360
  const sweepDeg = 245
  // Start & End rounded caps for Active Pace Arc (draw arc + caps into max-alpha mask for zero overlap seam!)
  let arcMask = 0
  if (relDeg <= sweepDeg) {
    arcMask = 1 - smoothstep(-aa, aa, dRing)
  }
  for (const capDeg of [-140, -140 + sweepDeg]) {
    const rad = (capDeg * Math.PI) / 180
    const cx = Math.cos(rad) * dialRadius
    const cy = Math.sin(rad) * dialRadius
    const dCap = Math.hypot(nx - cx, ny - cy) - ringHalfW
    arcMask = Math.max(arcMask, 1 - smoothstep(-aa, aa, dCap))
  }
  if (arcMask > 0) {
    const prog = relDeg > 300 ? 0 : clamp(relDeg / sweepDeg)
    const arcR = mix(153, 255, prog)
    const arcG = mix(246, 255, prog)
    const arcB = mix(228, 255, prog)
    blendOver(out, arcR, arcG, arcB, arcMask * boxAlpha * 0.96)
  }

  // 3. Precision Pace Needle (center -> upper-right 2 o'clock) + Left Pulse Tail
  const handRad = (-38 * Math.PI) / 180
  const hx = Math.cos(handRad) * 0.34
  const hy = Math.sin(handRad) * 0.34
  const dHand = sdSegment(nx, ny, 0, 0, hx, hy) - Math.max(0.068, pixelScale * 1.7)
  const handAlpha = (1 - smoothstep(-aa, aa, dHand)) * boxAlpha
  blendOver(out, 255, 255, 255, handAlpha)

  // Secondary short hour/rhythm bar (pointing ~8 o'clock / 195 deg)
  const subRad = (-148 * Math.PI) / 180
  const sx = Math.cos(subRad) * 0.22
  const sy = Math.sin(subRad) * 0.22
  const dSub = sdSegment(nx, ny, 0, 0, sx, sy) - Math.max(0.058, pixelScale * 1.5)
  const subAlpha = (1 - smoothstep(-aa, aa, dSub)) * boxAlpha
  blendOver(out, 186, 250, 240, subAlpha * 0.92)

  // Center luminous pivot
  const dCenter = r - Math.max(0.105, pixelScale * 2.1)
  const centerAlpha = (1 - smoothstep(-aa, aa, dCenter)) * boxAlpha
  blendOver(out, 255, 255, 255, centerAlpha)

  // Accent Momentum Dot at top-right (Amber-Gold #fbbf24 with crisp glow)
  const dotRad = (-38 * Math.PI) / 180
  const dx = Math.cos(dotRad) * dialRadius
  const dy = Math.sin(dotRad) * dialRadius
  const dDot = Math.hypot(nx - dx, ny - dy) - Math.max(0.11, pixelScale * 2.3)
  const dotAlpha = (1 - smoothstep(-aa, aa, dDot)) * boxAlpha
  blendOver(out, 251, 191, 36, dotAlpha)

  return out
}

function renderIconRGBA(size) {
  const buf = Buffer.alloc(size * size * 4)
  // 2x2 supersampling for large sizes, 3x3 for small sizes (16..64) for ultra-crisp edges
  const samples = size <= 64 ? 3 : 2
  const pixelScale = 2 / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sumR = 0
      let sumG = 0
      let sumB = 0
      let sumA = 0

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = (x + (sx + 0.5) / samples) / size
          const v = (y + (sy + 0.5) / samples) / size
          const nx = u * 2 - 1
          const ny = v * 2 - 1
          const px = sampleWorkPacerPixel(nx, ny, pixelScale)
          sumR += px.r * px.a
          sumG += px.g * px.a
          sumB += px.b * px.a
          sumA += px.a
        }
      }

      const count = samples * samples
      const finalA = sumA / count
      const idx = (y * size + x) * 4
      if (finalA > 0.001) {
        buf[idx] = Math.round(clamp(sumR / sumA, 0, 255))
        buf[idx + 1] = Math.round(clamp(sumG / sumA, 0, 255))
        buf[idx + 2] = Math.round(clamp(sumB / sumA, 0, 255))
        buf[idx + 3] = Math.round(clamp(finalA * 255, 0, 255))
      }
    }
  }
  return buf
}

/**
 * Encodes an RGBA image < 256px into a 32-bit BGRA DIB (BITMAPINFOHEADER + XOR + AND mask)
 * for maximum compatibility across Windows Explorer, Shortcuts, and rcedit.
 */
function encodeIcoDIB(size, rgba) {
  const headerSize = 40
  const xorSize = size * size * 4
  const andRowBytes = Math.ceil(size / 32) * 4
  const andSize = andRowBytes * size
  const dib = Buffer.alloc(headerSize + xorSize + andSize)

  dib.writeUInt32LE(headerSize, 0)
  dib.writeInt32LE(size, 4)
  dib.writeInt32LE(size * 2, 8) // combined XOR + AND height
  dib.writeUInt16LE(1, 12) // planes
  dib.writeUInt16LE(32, 14) // bpp
  dib.writeUInt32LE(0, 16) // BI_RGB
  dib.writeUInt32LE(xorSize + andSize, 20)

  // Bottom-up BGRA rows
  for (let y = 0; y < size; y++) {
    const srcY = size - 1 - y
    for (let x = 0; x < size; x++) {
      const sIdx = (srcY * size + x) * 4
      const dIdx = headerSize + (y * size + x) * 4
      dib[dIdx] = rgba[sIdx + 2] // B
      dib[dIdx + 1] = rgba[sIdx + 1] // G
      dib[dIdx + 2] = rgba[sIdx] // R
      dib[dIdx + 3] = rgba[sIdx + 3] // A
    }
  }
  return dib
}

function encodeICO(entries) {
  const count = entries.length
  const dirHeader = Buffer.alloc(6)
  dirHeader.writeUInt16LE(0, 0)
  dirHeader.writeUInt16LE(1, 2) // 1 = ICO
  dirHeader.writeUInt16LE(count, 4)

  const dirEntries = Buffer.alloc(count * 16)
  let offset = 6 + count * 16
  const payloads = []

  entries.forEach(({ size, data }, i) => {
    const pos = i * 16
    dirEntries[pos] = size >= 256 ? 0 : size
    dirEntries[pos + 1] = size >= 256 ? 0 : size
    dirEntries[pos + 2] = 0
    dirEntries[pos + 3] = 0
    dirEntries.writeUInt16LE(1, pos + 4) // color planes
    dirEntries.writeUInt16LE(32, pos + 6) // 32 bpp
    dirEntries.writeUInt32LE(data.length, pos + 8)
    dirEntries.writeUInt32LE(offset, pos + 12)
    offset += data.length
    payloads.push(data)
  })

  return Buffer.concat([dirHeader, dirEntries, ...payloads])
}

function encodeICNS(pngBySize) {
  const typeMap = [
    { size: 16, ostype: 'icp4' },
    { size: 32, ostype: 'icp5' },
    { size: 64, ostype: 'icp6' },
    { size: 128, ostype: 'ic07' },
    { size: 256, ostype: 'ic08' },
    { size: 512, ostype: 'ic09' }
  ]
  const chunks = []
  let totalLen = 8
  for (const { size, ostype } of typeMap) {
    const png = pngBySize.get(size)
    if (!png) continue
    const ch = Buffer.alloc(8 + png.length)
    ch.write(ostype, 0, 4, 'ascii')
    ch.writeUInt32BE(8 + png.length, 4)
    png.copy(ch, 8)
    chunks.push(ch)
    totalLen += ch.length
  }
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(totalLen, 4)
  return Buffer.concat([header, ...chunks])
}

const SVG_SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="wpBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0EA5E9" />
      <stop offset="50%" stop-color="#0D9488" />
      <stop offset="100%" stop-color="#4338CA" />
    </linearGradient>
    <linearGradient id="wpRim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.65" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.14" />
    </linearGradient>
    <linearGradient id="wpArc" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#99F6E4" />
      <stop offset="100%" stop-color="#FFFFFF" />
    </linearGradient>
  </defs>
  <rect x="30" y="30" width="452" height="452" rx="108" fill="url(#wpBg)" />
  <rect x="34" y="34" width="444" height="444" rx="104" fill="none" stroke="url(#wpRim)" stroke-width="8" />
  <circle cx="256" cy="256" r="138" fill="none" stroke="#FFFFFF" stroke-opacity="0.26" stroke-width="30" />
  <path d="M 150.3 167.3 A 138 138 0 1 1 220.3 389.3" fill="none" stroke="url(#wpArc)" stroke-width="30" stroke-linecap="round" />
  <line x1="256" y1="256" x2="208" y2="226" stroke="#BAFAF0" stroke-width="28" stroke-linecap="round" />
  <line x1="256" y1="256" x2="325" y2="202" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round" />
  <circle cx="256" cy="256" r="26" fill="#FFFFFF" />
  <circle cx="364.7" cy="171.0" r="27" fill="#FBBF24" />
</svg>
`

console.log('Generating WorkPacer Liquid Glass icons...')
const sizes = [16, 24, 32, 48, 64, 128, 256, 512]
const rgbaMap = new Map()
const pngMap = new Map()

for (const s of sizes) {
  const rgba = renderIconRGBA(s)
  rgbaMap.set(s, rgba)
  pngMap.set(s, encodePNG(s, s, rgba))
}

// 1. Write 512x512 build/icon.png & 256x256 resources/icon.png
writeFileSync(resolve(BUILD_DIR, 'icon.png'), pngMap.get(512))
writeFileSync(resolve(RES_DIR, 'icon.png'), pngMap.get(256))

// 2. Write multi-size Windows build/icon.ico (16, 24, 32, 48, 64, 128 DIB + 256 PNG)
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoEntries = icoSizes.map((s) => ({
  size: s,
  data: s === 256 ? pngMap.get(256) : encodeIcoDIB(s, rgbaMap.get(s))
}))
writeFileSync(resolve(BUILD_DIR, 'icon.ico'), encodeICO(icoEntries))

// 3. Write macOS build/icon.icns
writeFileSync(resolve(BUILD_DIR, 'icon.icns'), encodeICNS(pngMap))

// 4. Write SVG sources
writeFileSync(resolve(BUILD_DIR, 'icon.svg'), SVG_SOURCE, 'utf-8')
writeFileSync(resolve(RES_DIR, 'icon.svg'), SVG_SOURCE, 'utf-8')

console.log('Generated successfully:')
console.log(' - build/icon.png (512x512)')
console.log(' - build/icon.ico (16, 24, 32, 48, 64, 128, 256px)')
console.log(' - build/icon.icns (macOS multi-resolution)')
console.log(' - build/icon.svg & resources/icon.png')
