import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { UPLOAD_DIR, PRIVATE_DIR } from './db.js';
import { MAX_UPLOAD_MB } from './config.js';
import { HttpError } from './util.js';

const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/wav': '.wav', 'audio/x-m4a': '.m4a',
};

const WEB_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = (destination) => multer.diskStorage({
  destination,
  filename: (_req, file, cb) => {
    const base = file.mimetype.split(';')[0];
    cb(null, crypto.randomBytes(16).toString('hex') + (EXT[base] || '.bin'));
  },
});

function make(kinds, dir = UPLOAD_DIR, exact = []) {
  return multer({
    storage: storage(dir),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 8 },
    fileFilter: (_req, file, cb) => {
      const base = file.mimetype.split(';')[0];
      // SVG enviado por usuário pode conter script: aceitamos só imagens rasterizadas.
      // Imagem só nos formatos que todo navegador mostra (HEIC do iPhone, por exemplo, não aparece).
      const image = base.startsWith('image/');
      const ok = image ? kinds.includes('image') && WEB_IMAGES.includes(base) : kinds.some((k) => base.startsWith(k + '/')) || exact.includes(base);
      cb(ok ? null : new HttpError(400, image ? 'Use uma imagem em JPG, PNG ou WEBP' : 'Tipo de arquivo não permitido'), ok);
    },
  });
}

// Públicos: fotos de perfil, logos e ícones (aparecem nos perfis públicos).
export const imageUpload = make(['image']);
// Anexos de eventos: fotos e PDF.
export const attachmentUpload = make(['image'], UPLOAD_DIR, ['application/pdf']);
export const fileUrl = (file) => (file ? '/uploads/' + file.filename : null);

// Privados: servidos por /api/files/:kind/:name com checagem de permissão.
export const privateImageUpload = make(['image'], PRIVATE_DIR);
export const privateMediaUpload = make(['image', 'audio'], PRIVATE_DIR);
export const privateUrl = (kind, file) => (file ? `/api/files/${kind}/${file.filename}` : null);
