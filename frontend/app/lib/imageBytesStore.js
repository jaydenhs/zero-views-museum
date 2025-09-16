// In-memory store for raw LED/image bytes per canvas.
// Values are Uint8Array; resets on cold start.

const imageMap = new Map();

export function getImageBytes(id) {
  return imageMap.get(id) || null;
}

export function setImageBytes(id, bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("bytes must be Uint8Array");
  }
  imageMap.set(id, bytes);
  return bytes;
}

export function deleteImageBytes(id) {
  imageMap.delete(id);
}
