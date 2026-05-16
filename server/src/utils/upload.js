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

// Complaint media: allow images (5MB) + a single short video (25MB). The
// per-file size limit applies to both, so multer is configured with the
// larger cap and we enforce the image-only 5MB cap manually below.
const COMPLAINT_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const COMPLAINT_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const COMPLAINT_IMAGE_MAX = 5 * 1024 * 1024;
const COMPLAINT_VIDEO_MAX = 25 * 1024 * 1024;

const complaintFileFilter = (req, file, cb) => {
  if (file.fieldname === 'images' && COMPLAINT_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  if (file.fieldname === 'video' && COMPLAINT_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('نوع الملف غير مدعوم. الصور: JPEG/PNG/WebP — الفيديو: MP4/WebM/MOV.'), false);
};

export const complaintUpload = multer({
  storage,
  fileFilter: complaintFileFilter,
  limits: { fileSize: COMPLAINT_VIDEO_MAX },
});

// After multer has written the files, reject oversized images post-hoc and
// clean up. (Multer's single limit applies to the largest type accepted.)
export function enforceComplaintFileLimits(files) {
  const oversized = (files || []).find(
    (f) => f.fieldname === 'images' && f.size > COMPLAINT_IMAGE_MAX,
  );
  if (oversized) {
    const err = new Error('حجم الصورة يتجاوز 5 ميجابايت.');
    err.status = 400;
    throw err;
  }
}

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
