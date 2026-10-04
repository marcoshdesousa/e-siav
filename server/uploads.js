import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { UPLOAD_DIR, PRIVATE_DIR } from './db.js';
import { MAX_UPLOAD_MB } from './config.js';
import { HttpError } from './util.js';

const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
  'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/wav': '.wav', 'audio/x-m4a': '.m4a',
};

const storage = (destination) => multer.diskStorage({
  destination,
  filename: (_req, file, cb) => {
    const base = file.mimetype.split(';')[0];
    cb(null, crypto.randomBytes(16).toString('hex') + (EXT[base] || '.bin'));
  },
});

function make(kinds, dir = UPLOAD_DIR) {
  return multer({
    storage: storage(dir),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 8 },
    fileFilter: (_req, file, cb) => {
      const base = file.mimetype.split(';')[0];
      // SVG enviado por usuário pode conter script: aceitamos só imagens rasterizadas.
      const ok = kinds.some((k) => base.startsWith(k + '/')) && base !== 'image/svg+xml';
      cb(ok ? null : new HttpError(400, 'Tipo de arquivo não permitido'), ok);
    },
  });
}

// Públicos: fotos de perfil, logos e ícones (aparecem nos perfis públicos).
export const imageUpload = make(['image']);
export const fileUrl = (file) => (file ? '/uploads/' + file.filename : null);

// Privados: servidos por /api/files/:kind/:name com checagem de permissão.
export const privateImageUpload = make(['image'], PRIVATE_DIR);
export const privateMediaUpload = make(['image', 'audio'], PRIVATE_DIR);
export const privateUrl = (kind, file) => (file ? `/api/files/${kind}/${file.filename}` : null);
