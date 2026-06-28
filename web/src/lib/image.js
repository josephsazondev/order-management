// Resolve a user-pasted image URL into one that actually renders in an <img> tag.
//
// Google Drive *share* links (drive.google.com/file/d/ID/view, /open?id=ID, /uc?id=ID)
// don't load directly in an <img>. The thumbnail endpoint does — as long as the file is
// shared "Anyone with the link". We rewrite Drive links to that endpoint and pass any
// other URL (https, data:) through unchanged.

export function resolveLogoUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (!/drive\.google\.com|docs\.google\.com/i.test(url)) return url;

  // Pull the file id from the common Drive link shapes.
  let id = '';
  const path = url.match(/\/d\/([a-zA-Z0-9_-]+)/); // /file/d/<id>/view
  const query = url.match(/[?&]id=([a-zA-Z0-9_-]+)/); // ?id=<id> / open?id=<id> / uc?id=<id>
  if (path) id = path[1];
  else if (query) id = query[1];

  if (!id) return url; // unrecognized Drive URL — leave it as-is
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
}

// Make a string safe to use as a download filename: drop characters illegal on
// Windows/macOS, collapse whitespace, trim. Falls back to `fallback` if empty.
export function safeFileName(part, fallback = 'file') {
  const cleaned = String(part || '')
    .replace(/[\\/:*?"<>|]+/g, ' ') // illegal filename chars
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}
