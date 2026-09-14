import { db } from './db'

// ---------------------------------------------------------------------------
// User-taken photos of the real gym machines, stored on-device (IndexedDB),
// keyed by equipment id. Local-only — not part of cloud sync — since a photo is
// a device/gym-specific reference, not account data. Images are downscaled to a
// compact JPEG before storing so a few dozen photos stay tiny.
// ---------------------------------------------------------------------------

/** Downscale a captured image to a compact JPEG (longest side ≤ maxDim). */
export async function downscaleImage(file: Blob, maxDim = 1200, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file // decoding unsupported — store the original
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); return file }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const out = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', quality))
  return out ?? file
}

export async function setEquipmentPhoto(equipmentId: string, file: Blob): Promise<void> {
  const blob = await downscaleImage(file)
  await db.equipmentPhotos.put({ equipmentId, blob, updatedAt: Date.now() })
}

export async function deleteEquipmentPhoto(equipmentId: string): Promise<void> {
  await db.equipmentPhotos.delete(equipmentId)
}
