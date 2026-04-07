/**
 * Upload Routes
 * POST /api/uploads - Upload file
 * POST /api/uploads/avatar - Upload avatar
 * DELETE /api/uploads/:filename - Delete file
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../lib/logger';
import {
  createOwnedUploadFilename,
  isOwnedUploadFilename,
} from '../lib/uploadOwnership';
import {
  buildUploadUrl,
  deleteStoredFileByUrl,
  getUploadPrefix,
  isLocalStorageProvider,
  publishUploadedFile,
  tryDeleteStoredFileByUrl,
} from '../lib/storage';

const router = Router();

// ============================================
// CONFIGURATION
// ============================================

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const FILES_DIR = path.join(UPLOADS_DIR, 'files');
const AVATAR_URL_PREFIX = getUploadPrefix('avatars');

// Ensure directories exist
[UPLOADS_DIR, AVATARS_DIR, FILES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Allowed file types
const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILES = [
  ...ALLOWED_IMAGES,
  'application/pdf',
  'application/zip',
  'application/x-rar-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];
const BLOCKED_EXTENSIONS = new Set(['.exe', '.sh', '.bat', '.cmd', '.com', '.msi', '.ps1', '.jar']);

// File size limits
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isAvatar = req.path.includes('avatar');
    cb(null, isAvatar ? AVATARS_DIR : FILES_DIR);
  },
  filename: (req, file, cb) => {
    const isAvatar = req.path.includes('avatar');

    if (isAvatar) {
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${Date.now()}_${uniqueId}${ext}`;
      cb(null, safeName);
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      cb(new Error('Требуется авторизация для загрузки файла'), '');
      return;
    }

    cb(null, createOwnedUploadFilename(userId, file.originalname));
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isAvatar = req.path.includes('avatar');
  const allowedTypes = isAvatar ? ALLOWED_IMAGES : ALLOWED_FILES;
  const extension = path.extname(file.originalname).toLowerCase();

  if (BLOCKED_EXTENSIONS.has(extension)) {
    cb(new Error('Исполняемые файлы запрещены'));
    return;
  }

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Недопустимый тип файла: ${file.mimetype}`));
  }
};

const uploadFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_AVATAR_SIZE,
  },
});

// ============================================
// ERROR HANDLER FOR MULTER
// ============================================

const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Файл слишком большой',
      });
    }
    return res.status(400).json({
      success: false,
      error: `Ошибка загрузки: ${err.message}`,
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  
  next();
};

// ============================================
// UPLOAD FILE
// ============================================

router.post('/', authMiddleware, uploadFile.single('file'), handleMulterError, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Файл не выбран',
      });
    }
    
    const fileUrl = await publishUploadedFile({
      type: 'files',
      filename: file.filename,
      localPath: file.path,
      mimeType: file.mimetype,
    });
    
    logger.info('File uploaded', {
      userId: user.id,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
    });
    
    res.json({
      success: true,
      data: {
        url: fileUrl,
        filename: file.filename,
        fileName: file.originalname,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        mimeType: file.mimetype,
      },
    });
  } catch (error) {
    logger.error('File upload error', { error });
    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки файла',
    });
  }
});

// ============================================
// UPLOAD MULTIPLE FILES
// ============================================

router.post('/multiple', authMiddleware, uploadFile.array('files', 10), handleMulterError, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Файлы не выбраны',
      });
    }
    
    const uploadedFiles = await Promise.all(
      files.map(async (file) => ({
        url: await publishUploadedFile({
          type: 'files',
          filename: file.filename,
          localPath: file.path,
          mimeType: file.mimetype,
        }),
        filename: file.filename,
        fileName: file.originalname,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        mimeType: file.mimetype,
      }))
    );
    
    logger.info('Multiple files uploaded', {
      userId: user.id,
      count: files.length,
    });
    
    res.json({
      success: true,
      data: uploadedFiles,
    });
  } catch (error) {
    logger.error('Multiple file upload error', { error });
    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки файлов',
    });
  }
});

// ============================================
// UPLOAD AVATAR
// ============================================

router.post('/avatar', authMiddleware, uploadAvatar.single('avatar'), handleMulterError, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Файл не выбран',
      });
    }
    
    // Delete old avatar if exists
    const { prisma } = await import('../lib/prisma');
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatar: true },
    });
    
    if (currentUser?.avatar && currentUser.avatar.startsWith(AVATAR_URL_PREFIX)) {
      if (isLocalStorageProvider()) {
        const oldAvatarPath = path.join(AVATARS_DIR, path.basename(currentUser.avatar));
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }
      await tryDeleteStoredFileByUrl(currentUser.avatar);
    }
    
    const avatarUrl = await publishUploadedFile({
      type: 'avatars',
      filename: file.filename,
      localPath: file.path,
      mimeType: file.mimetype,
    });
    
    // Update user avatar
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar: avatarUrl },
    });
    
    logger.info('Avatar uploaded', {
      userId: user.id,
      filename: file.filename,
    });
    
    res.json({
      success: true,
      data: {
        url: avatarUrl,
      },
      message: 'Аватар обновлён',
    });
  } catch (error) {
    logger.error('Avatar upload error', { error });
    res.status(500).json({
      success: false,
      error: 'Ошибка загрузки аватара',
    });
  }
});

// ============================================
// DELETE FILE
// ============================================

router.delete('/:type/:filename', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { type, filename } = req.params;
    
    // Validate type
    if (!['files', 'avatars'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Недопустимый тип файла',
      });
    }
    
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, type, sanitizedFilename);

    const { prisma } = await import('../lib/prisma');

    if (user.role !== 'ADMIN') {
      if (type === 'avatars') {
        const currentUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { avatar: true },
        });

        const currentAvatarFilename = currentUser?.avatar ? path.basename(currentUser.avatar) : null;
        if (!currentAvatarFilename || currentAvatarFilename !== sanitizedFilename) {
          return res.status(403).json({
            success: false,
            error: 'Нельзя удалить чужой аватар',
          });
        }
      }

      if (type === 'files') {
        if (!isOwnedUploadFilename(sanitizedFilename, user.id)) {
          return res.status(403).json({
            success: false,
            error: 'Нельзя удалить чужой файл',
          });
        }
      }
    }
    
    if (isLocalStorageProvider()) {
      // Check file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'Файл не найден',
        });
      }

      fs.unlinkSync(filePath);
    } else {
      await deleteStoredFileByUrl(buildUploadUrl(type as 'files' | 'avatars', sanitizedFilename));
    }
    
    logger.info('File deleted', {
      userId: user.id,
      filename: sanitizedFilename,
      type,
    });
    
    res.json({
      success: true,
      message: 'Файл удалён',
    });
  } catch (error) {
    logger.error('File delete error', { error });
    res.status(500).json({
      success: false,
      error: 'Ошибка удаления файла',
    });
  }
});

// ============================================
// GET UPLOAD CONFIG
// ============================================

router.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      maxAvatarSize: MAX_AVATAR_SIZE,
      maxFileSize: MAX_FILE_SIZE,
      allowedImages: ALLOWED_IMAGES,
      allowedFiles: ALLOWED_FILES,
    },
  });
});

export default router;
