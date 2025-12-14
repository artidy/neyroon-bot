import prisma from '../database/prisma';
import fs from 'fs/promises';
import path from 'path';
import { uploadConfig } from '../utils/config';

export class DrawingService {
  async saveDrawing(
    userId: string,
    lessonId: string,
    fileId: string,
    fileName: string,
    filePath: string
  ) {
    return await prisma.drawing.create({
      data: {
        userId,
        lessonId,
        fileId,
        fileName,
        filePath,
      },
    });
  }

  async getDrawingsByUser(userId: string) {
    return await prisma.drawing.findMany({
      where: { userId },
      include: {
        lesson: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getDrawingsByLesson(lessonId: string) {
    return await prisma.drawing.findMany({
      where: { lessonId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getUncommentedDrawings() {
    return await prisma.drawing.findMany({
      where: {
        comment: null,
      },
      include: {
        user: true,
        lesson: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async addComment(drawingId: string, comment: string, commentedBy: string) {
    return await prisma.drawing.update({
      where: { id: drawingId },
      data: {
        comment,
        commentedBy,
        commentedAt: new Date(),
      },
    });
  }

  async getDrawing(drawingId: string) {
    return await prisma.drawing.findUnique({
      where: { id: drawingId },
      include: {
        user: true,
        lesson: true,
      },
    });
  }

  async deleteDrawing(drawingId: string) {
    const drawing = await this.getDrawing(drawingId);
    if (!drawing) return null;

    // Удаляем файл с диска
    try {
      await fs.unlink(drawing.filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Удаляем запись из БД
    return await prisma.drawing.delete({
      where: { id: drawingId },
    });
  }

  async ensureUploadDirectory() {
    const drawingsPath = path.join(uploadConfig.path, 'drawings');
    try {
      await fs.access(drawingsPath);
    } catch {
      await fs.mkdir(drawingsPath, { recursive: true });
    }
  }

  async getAllDrawings(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [drawings, total] = await Promise.all([
      prisma.drawing.findMany({
        skip,
        take: limit,
        include: {
          user: true,
          lesson: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.drawing.count(),
    ]);

    return {
      drawings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDrawingStats() {
    const total = await prisma.drawing.count();
    const commented = await prisma.drawing.count({
      where: {
        comment: {
          not: null,
        },
      },
    });
    const pending = total - commented;

    return {
      total,
      commented,
      pending,
    };
  }
}

export default new DrawingService();
