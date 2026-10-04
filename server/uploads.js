import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { UPLOAD_DIR } from './db.js';
import { MAX_UPLOAD_MB } from './config.js';
import { HttpError } from './util.js';

const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
  'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/wav': '.wav', 'audio/x-m4a': '.m4a',
};

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const base = file.mimetype.split(';')[0];
    cb(null, crypto.randomBytes(12).toString('hex') + (EXT[base] || path.extname(file.originalname).slice(0, 6)));
  },
});

function make(kinds) {
  return multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 8 },
    fileFilter: (_req, file, cb) => {
      const base = file.mimetype.split(';')[0];
      // SVG enviado por usuário pode conter script: aceitamos só imagens rasterizadas.
      const ok = kinds.some((k) => base.startsWith(k + '/')) && base !== 'image/svg+xml';
      cb(ok ? null : new HttpError(400, 'Tipo de arquivo não permitido'), ok);
    },
  });
}

export const imageUpload = make(['image']);
export const mediaUpload = make(['image', 'audio']);
export const fileUrl = (file) => (file ? '/uploads/' + file.filename : null);
