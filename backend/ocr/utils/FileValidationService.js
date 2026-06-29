const ALLOWED_MIME = ['image/jpeg','image/jpg','image/png','image/bmp','image/tiff','image/webp','application/pdf'];
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export function validateFile(file) {
  if (!file) return { ok: false, reason: 'No file uploaded' };
  if (!ALLOWED_MIME.includes(file.mimetype)) return { ok: false, reason: 'Unsupported file type' };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: 'File too large' };
  return { ok: true };
}
