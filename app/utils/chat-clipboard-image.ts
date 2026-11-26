export const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_CHAT_IMAGE_PIXELS = 25_000_000

export async function prepareClipboardImage(file: File): Promise<File> {
  const header = await file.slice(0, 12).arrayBuffer()
  const bytes = new Uint8Array(header)
  const decoder = new TextDecoder()
  const format = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'jpeg'
    : bytes[0] === 0x89 && decoder.decode(bytes.subarray(1, 8)) === 'PNG\r\n\x1a\n' ? 'png'
      : decoder.decode(bytes.subarray(0, 4)) === 'RIFF' && decoder.decode(bytes.subarray(8, 12)) === 'WEBP' ? 'webp'
        : undefined
  if (!format) throw new Error('剪贴板图片仅支持 JPEG、PNG、WebP。')

  const type = `image/${format}`
  const name = file.name.replace(/\.[^.]+$/, '') || 'clipboard'
  // Clipboard MIME labels can differ from the encoded bytes.
  const source = file.type === type ? file : new File([file], `${name}.${format}`, { type })
  const bitmap = await createImageBitmap(source).catch(() => {
    throw new Error('无法读取剪贴板中的图片。')
  })
  try {
    const pixels = bitmap.width * bitmap.height
    if (pixels <= MAX_CHAT_IMAGE_PIXELS && file.size <= MAX_CHAT_IMAGE_BYTES) return source

    const scale = Math.min(1, Math.sqrt(MAX_CHAT_IMAGE_PIXELS / pixels))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(bitmap.width * scale))
    canvas.height = Math.max(1, Math.floor(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法处理剪贴板中的图片。')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const encode = (mimeType: string) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, 0.9))
    let result = await encode(type)
    if (!result || result.size > MAX_CHAT_IMAGE_BYTES) result = await encode('image/webp')
    if (!result || result.size > MAX_CHAT_IMAGE_BYTES) {
      throw new Error('处理后的剪贴板图片仍超过 10 MiB。')
    }
    return new File([result], `${name}.${result.type.slice(6)}`, { type: result.type })
  } finally {
    bitmap.close()
  }
}
