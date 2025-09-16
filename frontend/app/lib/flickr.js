// Convert a Flickr static image URL to a different size variant using suffixes
// Common suffixes: s (75 square), q (150 square), t (100), m (240), n (320), z (640), c (800), b (1024)
export function toFlickrSize(originalUrl, sizeSuffix = "q") {
  try {
    if (!originalUrl) return originalUrl;
    const url = new URL(originalUrl);
    const pathname = url.pathname; // e.g. /65535/52608812345_abcdef_b.jpg
    const dotIndex = pathname.lastIndexOf(".");
    if (dotIndex === -1) return originalUrl;
    const base = pathname.substring(0, dotIndex); // /.../_b
    const ext = pathname.substring(dotIndex); // .jpg/.png

    // If base already has a suffix like _b, _z, etc., replace it; else append
    const suffixMatch = base.match(/_(s|q|t|m|n|z|c|b|h|k|o)$/i);
    const newBase = suffixMatch
      ? base.replace(/_(s|q|t|m|n|z|c|b|h|k|o)$/i, `_${sizeSuffix}`)
      : `${base}_${sizeSuffix}`;

    url.pathname = `${newBase}${ext}`;
    return url.toString();
  } catch {
    return originalUrl;
  }
}
