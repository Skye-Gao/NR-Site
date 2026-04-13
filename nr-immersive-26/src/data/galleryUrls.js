/** Build URL for files in `static/` (Vite publicDir), e.g. 2026 Gallery / Artist / file.jpg */
export function galleryAssetUrl(baseFolder, artistFolder, fileName) {
  const seg = (s) => encodeURIComponent(s)
  const base = baseFolder.split('/').filter(Boolean).map(seg).join('/')
  return `/${base}/${seg(artistFolder)}/${seg(fileName)}`
}

export function formatMediaLabel(fileName) {
  const withoutExt = fileName.replace(/\.[^/.]+$/i, '')
  return withoutExt.replace(/_/g, ' ').trim() || fileName
}

export function pausePopupMedia(root) {
  if (!root) return
  root.querySelectorAll('video, audio').forEach((el) => {
    try {
      el.pause()
    } catch {
      /* ignore */
    }
  })
}
