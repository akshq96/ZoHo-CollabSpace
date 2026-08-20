import { API_BASE } from '../config';

// Backend origin without the trailing /api — e.g. http://localhost:8000 —
// used to resolve relative media URLs like "/uploads/chat/<id>.jpg" that the
// backend returns when Cloudinary isn't configured (see storageService.js).
const MEDIA_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

/**
 * Resolve a stored media/file URL to something an <img>/<video>/<a> tag can
 * load directly. Absolute URLs (Cloudinary, dicebear, picsum, data: URIs)
 * pass through unchanged; relative "/uploads/..." paths get the backend
 * origin prefixed.
 */
export function resolveUrl(url) {
  if (!url) return url;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return `${MEDIA_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
