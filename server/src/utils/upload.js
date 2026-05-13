import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. يرجى رفع صورة (JPEG, PNG, WebP).'), false);
  }
};

// 5MB per file
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Convert uploaded file to URL path
export function fileToUrl(file) {
  return `/uploads/${file.filename}`;
}

// Convert array of uploaded files to URL array
export function filesToUrls(files) {
  return (files || []).map(f => `/uploads/${f.filename}`);
}

// Save a base64 string as a file and return URL (for migration/seed)
export function base64ToFile(base64String) {
  const match = base64String.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return base64String; // already a URL or invalid
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(match[2], 'base64'));
  return `/uploads/${filename}`;
}

// Check if a string is a base64 image
export function isBase64Image(str) {
  return typeof str === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(str);
}

// Check if a string is an upload URL
export function isUploadUrl(str) {
  return typeof str === 'string' && str.startsWith('/uploads/');
}
