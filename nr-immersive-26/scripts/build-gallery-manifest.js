import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const galleryRoot = path.join(__dirname, '../static/2026 Gallery')
const outDir = path.join(__dirname, '../src/data')
const outFile = path.join(outDir, 'galleryManifest.json')
const artistCsvPath = path.join(galleryRoot, 'Artist Information - Sheet1.csv')

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov'])
const AUDIO_EXT = new Set(['.wav', '.mp3', '.m4a', '.ogg'])

function extOf(name) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function typeForFile(name) {
  const e = extOf(name)
  if (IMAGE_EXT.has(e)) return 'image'
  if (VIDEO_EXT.has(e)) return 'video'
  if (AUDIO_EXT.has(e)) return 'audio'
  return null
}

function listArtistFolders() {
  if (!fs.existsSync(galleryRoot)) {
    console.warn('Gallery root missing:', galleryRoot)
    return []
  }
  return fs
    .readdirSync(galleryRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** Match "Jason de Caires Taylor" to CSV "Jason DeCaires" + "Taylor" */
function nameKey(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '')
}

/** RFC-style CSV with quoted multiline fields */
function parseCsvMultiline(text) {
  const rows = []
  let row = []
  let field = ''
  let i = 0
  let inQuotes = false
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += c
        i++
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      if (text[i] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    if (c === '\n') {
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length || row.length) {
    row.push(field)
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  }
  return rows
}

function loadArtistCsvMap() {
  const map = new Map()
  if (!fs.existsSync(artistCsvPath)) {
    console.warn('Artist CSV not found:', artistCsvPath)
    return map
  }
  const raw = fs.readFileSync(artistCsvPath, 'utf8')
  const rows = parseCsvMultiline(raw)
  if (rows.length < 2) return map

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    while (row.length < 4) row.push('')
    const fn = (row[0] ?? '').trim()
    const ln = (row[1] ?? '').trim()
    const bio = (row[2] ?? '').trim()
    const artistStatement = (row[3] ?? '').trim()
    const full = `${fn} ${ln}`.replace(/\s+/g, ' ').trim()
    if (!full) continue
    map.set(nameKey(full), { bio, artistStatement })
  }
  return map
}

const artistTextByKey = loadArtistCsvMap()

const artists = []

for (const folder of listArtistFolders()) {
  const dir = path.join(galleryRoot, folder)
  const files = fs
    .readdirSync(dir)
    .filter((f) => typeForFile(f))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const media = files.map((file) => ({
    file,
    type: typeForFile(file),
  }))

  const firstImage = media.find((m) => m.type === 'image')
  const text = artistTextByKey.get(nameKey(folder)) || { bio: '', artistStatement: '' }

  artists.push({
    folder,
    name: folder,
    posterFile: firstImage ? firstImage.file : null,
    media,
    bio: text.bio,
    artistStatement: text.artistStatement,
  })
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, JSON.stringify({ baseFolder: '2026 Gallery', artists }, null, 2), 'utf8')
console.log('Wrote', outFile, `(${artists.length} artists, ${artists.filter((a) => a.posterFile).length} with poster)`)
