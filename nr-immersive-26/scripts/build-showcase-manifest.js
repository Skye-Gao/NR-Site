import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const showcaseRoot = path.join(__dirname, '../static/AWCS')
const outDir = path.join(__dirname, '../src/data')
const outFile = path.join(outDir, 'showcaseManifest.json')
const csvCandidates = [
  'ACWS Artist Info - Sheet1.csv',
  'AWCS Artist Info - Sheet1.csv',
  'Artist Information - Sheet1.csv',
]

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov'])
const AUDIO_EXT = new Set(['.wav', '.mp3', '.m4a', '.ogg'])
const PDF_EXT = new Set(['.pdf'])

/** Folder name on disk → Name cell in CSV when they differ */
const FOLDER_TO_CSV_NAME = {
  'Jordan Temchak': 'Jordan Tyler Temchack',
  'Ollie Peirce': 'Ollie Pierce',
  'Helena Jalenka': 'Helena Jalanka',
}

/** Optional external media per folder (for oversized/off-repo files). */
const EXTERNAL_MEDIA_BY_FOLDER = {
  'Jordan Temchak': [
    {
      type: 'youtube',
      label: 'Viola Bottom (YouTube)',
      url: 'https://www.youtube.com/embed/xkjG8YkLaRs',
      thumbnailUrl: 'https://img.youtube.com/vi/xkjG8YkLaRs/hqdefault.jpg',
    },
  ],
}

function extOf(name) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function typeForFile(name) {
  const e = extOf(name)
  if (IMAGE_EXT.has(e)) return 'image'
  if (VIDEO_EXT.has(e)) return 'video'
  if (AUDIO_EXT.has(e)) return 'audio'
  if (PDF_EXT.has(e)) return 'pdf'
  return null
}

function listArtistFolders() {
  if (!fs.existsSync(showcaseRoot)) {
    console.warn('Showcase root missing:', showcaseRoot)
    return []
  }
  return fs
    .readdirSync(showcaseRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function nameKey(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '')
}

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

function resolveCsvPath() {
  for (const name of csvCandidates) {
    const p = path.join(showcaseRoot, name)
    if (fs.existsSync(p)) return p
  }
  return null
}

function loadShowcaseCsvMap() {
  const map = new Map()
  const csvPath = resolveCsvPath()
  if (!csvPath) {
    console.warn('Showcase CSV not found in', showcaseRoot, '(tried:', csvCandidates.join(', '), ')')
    return map
  }
  const raw = fs.readFileSync(csvPath, 'utf8')
  const rows = parseCsvMultiline(raw)
  if (rows.length < 2) return map

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    while (row.length < 4) row.push('')
    const name = (row[0] ?? '').trim()
    const work = (row[1] ?? '').trim()
    const statement = (row[2] ?? '').trim()
    const bio = (row[3] ?? '').trim()
    if (!name) continue
    map.set(nameKey(name), { work, artistStatement: statement, bio })
  }
  return map
}

function csvKeyForFolder(folder) {
  const alias = FOLDER_TO_CSV_NAME[folder]
  return nameKey(alias || folder)
}

const artistTextByKey = loadShowcaseCsvMap()
const artists = []

for (const folder of listArtistFolders()) {
  const dir = path.join(showcaseRoot, folder)
  const files = fs
    .readdirSync(dir)
    .filter((f) => typeForFile(f))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const media = files.map((file) => ({
    file,
    type: typeForFile(file),
  }))
  const externalMedia = EXTERNAL_MEDIA_BY_FOLDER[folder] || []
  const combinedMedia = [...media, ...externalMedia]

  const firstImage = combinedMedia.find((m) => m.type === 'image')
  const text = artistTextByKey.get(csvKeyForFolder(folder)) || {
    work: '',
    artistStatement: '',
    bio: '',
  }

  if (combinedMedia.length === 0) continue

  artists.push({
    folder,
    name: folder,
    workTitle: text.work,
    posterFile: firstImage?.file || null,
    media: combinedMedia,
    artistStatement: text.artistStatement,
    bio: text.bio,
  })
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(
  outFile,
  JSON.stringify({ baseFolder: 'AWCS', artists }, null, 2),
  'utf8'
)
console.log(
  'Wrote',
  outFile,
  `(${artists.length} artists, ${artists.filter((a) => a.posterFile).length} with image poster)`
)
