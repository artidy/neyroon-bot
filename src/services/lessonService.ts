import prisma from '../database/prisma';
import { LessonType } from '@prisma/client';

export class LessonService {
  async getLesson(lessonNumber: number) {
    return await prisma.lesson.findUnique({
      where: { lessonNumber },
      include: {
        videos: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async getAllLessons() {
    return await prisma.lesson.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        videos: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async createLesson(data: {
    lessonNumber: number;
    type: LessonType;
    title?: string;
    description?: string;
    previewVideoUrl?: string;
    fullVideoUrl?: string;
    practiceText?: string;
    order: number;
  }) {
    return await prisma.lesson.create({
      data,
    });
  }

  async updateLesson(lessonNumber: number, data: Partial<{
    type: LessonType;
    title: string;
    description: string;
    previewVideoUrl: string;
    fullVideoUrl: string;
    practiceText: string;
    order: number;
    isActive: boolean;
    videos: Array<{
      id?: string;
      title: string;
      videoUrl: string;
      order: number;
    }>;
  }>) {
    const { videos, ...lessonData } = data;

    // Update lesson
    const lesson = await prisma.lesson.update({
      where: { lessonNumber },
      data: lessonData,
    });

    // Update videos if provided
    if (videos !== undefined) {
      // Delete existing videos
      await prisma.lessonVideo.deleteMany({
        where: { lessonId: lesson.id },
      });

      // Create new videos
      if (videos && videos.length > 0) {
        await prisma.lessonVideo.createMany({
          data: videos.map(v => ({
            lessonId: lesson.id,
            title: v.title,
            videoUrl: v.videoUrl,
            order: v.order,
          })),
        });
      }
    }

    return this.getLesson(lessonNumber);
  }

  async deleteLesson(lessonNumber: number) {
    return await prisma.lesson.update({
      where: { lessonNumber },
      data: { isActive: false },
    });
  }

  async getLessonByType(type: LessonType) {
    return await prisma.lesson.findFirst({
      where: { type, isActive: true },
      include: {
        videos: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async getLessonsByType(type: LessonType) {
    return await prisma.lesson.findMany({
      where: { type, isActive: true },
      orderBy: { order: 'asc' },
      include: {
        videos: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async canAccessLesson(userId: string, lessonNumber: number): Promise<boolean> {
    const lesson = await this.getLesson(lessonNumber);
    if (!lesson) return false;

    // Бесплатный урок доступен новичкам
    if (lesson.type === LessonType.FREE) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      return user?.isNewbie === true;
    }

    // Премиум уроки требуют подписку
    if (lesson.type === LessonType.PREMIUM) {
      const activeSub = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'completed',
          endDate: {
            gte: new Date(),
          },
        },
      });
      return !!activeSub;
    }

    return false;
  }

  async initializeLessons() {
    const existingLessons = await prisma.lesson.count();
    if (existingLessons > 0) return;

    const lessons = [
      {
        lessonNumber: 1,
        type: LessonType.FREE,
        title: 'Бесплатный урок - Основы',
        description: 'Базовые техники и первая практика',
        order: 1,
      },
      {
        lessonNumber: 2,
        type: LessonType.PREMIUM,
        title: 'Урок 2 - Линии и формы',
        description: 'Учимся рисовать основные формы',
        order: 2,
      },
      {
        lessonNumber: 3,
        type: LessonType.PREMIUM,
        title: 'Урок 3 - Перспектива',
        description: 'Основы перспективы в рисунке',
        order: 3,
      },
      {
        lessonNumber: 4,
        type: LessonType.PREMIUM,
        title: 'Урок 4 - Свет и тень',
        description: 'Работа с светотенью',
        order: 4,
      },
      {
        lessonNumber: 5,
        type: LessonType.PREMIUM,
        title: 'Урок 5 - Композиция',
        description: 'Построение композиции',
        order: 5,
      },
      {
        lessonNumber: 6,
        type: LessonType.PREMIUM,
        title: 'Урок 6 - Текстуры',
        description: 'Создание различных текстур',
        order: 6,
      },
      {
        lessonNumber: 7,
        type: LessonType.PREMIUM,
        title: 'Урок 7 - Цвет',
        description: 'Основы работы с цветом',
        order: 7,
      },
      {
        lessonNumber: 8,
        type: LessonType.PREMIUM,
        title: 'Урок 8 - Детализация',
        description: 'Проработка деталей',
        order: 8,
      },
    ];

    await prisma.lesson.createMany({
      data: lessons,
    });

    console.log('Lessons initialized successfully');
  }
}

export default new LessonService();
