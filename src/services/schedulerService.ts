import cron, { ScheduledTask } from 'node-cron';
import prisma from '../database/prisma';
import lessonService from './lessonService';
import userService from './userService';
import paymentService from './paymentService';
import { Bot, InputFile } from 'grammy';
import { UserStatus } from '@prisma/client';
import { BotContext } from '../bot';
import path from 'path';

export class SchedulerService {
  private tasks: ScheduledTask[] = [];

  async startDailyLessonDistribution(bot: Bot<BotContext>) {
    // Проверка каждые 15 минут для отправки уроков по времени пользователей
    const task = cron.schedule('*/15 * * * *', async () => {
      await this.distributeScheduledLessons(bot);
    });

    this.tasks.push(task);
    console.log('Daily lesson distribution scheduler started (every 15 minutes)');
  }

  async distributeScheduledLessons(bot: Bot<BotContext>) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:00`;

    console.log(`[${now.toISOString()}] Checking for lessons to send at ${currentTime}`);

    // Проверяем только в начале часа (в первые 15 минут)
    if (currentMinutes >= 15) {
      console.log(`Skipping - not in the first 15 minutes of the hour (current: ${currentMinutes})`);
      return;
    }

    // Получаем всех активных пользователей с текущим временем
    const users = await prisma.user.findMany({
      where: {
        status: {
          in: [UserStatus.ACTIVE, UserStatus.TRIAL],
        },
        preferredTime: currentTime,
      },
      include: {
        subscriptions: {
          where: {
            status: 'completed',
            endDate: {
              gte: new Date(),
            },
            deletedAt: null,
          },
        },
      },
    });

    console.log(`Found ${users.length} users with preferred time ${currentTime}`);

    for (const user of users) {
      try {
        // Проверяем, есть ли активная подписка
        if (!user.subscriptions || user.subscriptions.length === 0) {
          console.log(`User ${user.telegramId} has no active subscription`);
          continue;
        }

        const nextLessonNumber = user.currentLessonDay + 1;
        const lesson = await lessonService.getLesson(nextLessonNumber);

        if (!lesson) {
          console.log(`No more lessons for user ${user.telegramId} (current day: ${user.currentLessonDay})`);
          continue;
        }

        // Проверяем доступ
        const hasAccess = await lessonService.canAccessLesson(user.id, nextLessonNumber);
        if (!hasAccess) {
          console.log(`User ${user.telegramId} doesn't have access to lesson ${nextLessonNumber}`);
          continue;
        }

        console.log(`Sending lesson ${nextLessonNumber} to user ${user.telegramId} (${user.firstName})`);

        // Отправляем урок
        await this.sendLessonToUser(bot, user, lesson);

        // Обновляем прогресс
        await userService.incrementLessonDay(user.id);

        console.log(`✅ Lesson ${nextLessonNumber} sent to user ${user.telegramId}`);
      } catch (error) {
        console.error(`❌ Error sending lesson to user ${user.telegramId}:`, error);
      }
    }
  }

  async sendLessonToUser(bot: Bot<BotContext>, user: any, lesson: any) {
    const telegramId = Number(user.telegramId);

    await bot.api.sendMessage(
      telegramId,
      `📚 **Урок ${lesson.lessonNumber}: ${lesson.title}**\n\n${lesson.description || ''}\n\nПриступим!`,
      { parse_mode: 'Markdown' }
    );

    // Отправляем видео из нового массива videos, если есть
    if (lesson.videos && lesson.videos.length > 0) {
      for (const video of lesson.videos) {
        await this.sendVideoMessage(bot, telegramId, video.videoUrl, `🎥 **${video.title}**`);
      }
    } else {
      // Fallback на старые поля, если новых видео нет
      if (lesson.previewVideoUrl) {
        await this.sendVideoMessage(bot, telegramId, lesson.previewVideoUrl, '📹 **Превью урока:**');
      }

      if (lesson.fullVideoUrl) {
        await this.sendVideoMessage(bot, telegramId, lesson.fullVideoUrl, '🎥 **Полный урок:**');
      }
    }

    if (lesson.practiceText) {
      await bot.api.sendMessage(
        telegramId,
        `✏️ **Практическое задание:**\n\n${lesson.practiceText}\n\nПосле выполнения отправьте свой рисунок в чат!`
      );
    }
  }

  async sendVideoMessage(bot: Bot<BotContext>, telegramId: number, videoUrl: string, caption: string) {
    // Проверяем, является ли это локальный файл или URL
    const isLocalFile = videoUrl.includes('/uploads/videos/') || videoUrl.match(/\.(mp4|mov|avi|mkv|webm)$/i);

    if (isLocalFile) {
      // Для локальных файлов используем InputFile с защитой от копирования
      const filePath = videoUrl.startsWith('/')
        ? path.join(process.cwd(), videoUrl.substring(1))
        : path.join(process.cwd(), videoUrl);

      await bot.api.sendVideo(telegramId, new InputFile(filePath), {
        caption: caption,
        has_spoiler: false,
        supports_streaming: true,
        // Защита от копирования
        protect_content: true,
      });
    } else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      // Для YouTube отправляем ссылку с превью
      await bot.api.sendMessage(
        telegramId,
        `${caption}\n\n${videoUrl}`,
        {
          link_preview_options: {
            is_disabled: false,
            prefer_large_media: true,
            show_above_text: true,
          },
        }
      );
    } else {
      // Для других ссылок просто отправляем текст
      await bot.api.sendMessage(telegramId, `${caption}\n\n${videoUrl}`);
    }
  }

  async checkExpiredSubscriptions() {
    // Проверка истекших подписок раз в день
    const task = cron.schedule('0 0 * * *', async () => {
      await paymentService.getExpiredSubscriptions();
      console.log('Checked for expired subscriptions');
    });

    this.tasks.push(task);
    console.log('Subscription expiry checker started');
  }

  async sendReminderToInactiveUsers(bot: Bot<BotContext>) {
    // Напоминание неактивным пользователям раз в неделю
    const task = cron.schedule('0 10 * * 1', async () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const inactiveUsers = await prisma.user.findMany({
        where: {
          status: {
            in: [UserStatus.ACTIVE, UserStatus.TRIAL],
          },
          lastActivityAt: {
            lt: oneWeekAgo,
          },
        },
      });

      for (const user of inactiveUsers) {
        try {
          await bot.api.sendMessage(
            Number(user.telegramId),
            '👋 Привет! Давно не видели вас на курсе.\n\nНе забывайте про уроки и практику! Используйте /menu для продолжения обучения.'
          );
        } catch (error) {
          console.error(`Error sending reminder to user ${user.telegramId}:`, error);
        }
      }

      console.log(`Sent reminders to ${inactiveUsers.length} inactive users`);
    });

    this.tasks.push(task);
    console.log('Inactive users reminder scheduler started');
  }

  stopAll() {
    this.tasks.forEach((task) => task.stop());
    this.tasks = [];
    console.log('All schedulers stopped');
  }

  async initializeSchedulers(bot: Bot<BotContext>) {
    await this.startDailyLessonDistribution(bot);
    await this.checkExpiredSubscriptions();
    await this.sendReminderToInactiveUsers(bot);
    console.log('All schedulers initialized');
  }
}

export default new SchedulerService();
