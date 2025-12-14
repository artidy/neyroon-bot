import { Context } from 'grammy';
import userService from '../../services/userService';
import lessonService from '../../services/lessonService';
import drawingService from '../../services/drawingService';
import { messages } from '../messages';
import path from 'path';
import fs from 'fs/promises';
import { uploadConfig } from '../../utils/config';

export async function handleDrawingUpload(ctx: Context) {
  if (!ctx.from || !ctx.message) return;

  const user = await userService.getUserByTelegramId(ctx.from.id);
  if (!user) {
    await ctx.reply('Пожалуйста, начните с команды /start');
    return;
  }

  // Получаем файл из сообщения
  let fileId: string | undefined;
  let fileName = `drawing_${Date.now()}`;

  if (ctx.message.photo && ctx.message.photo.length > 0) {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    fileId = photo.file_id;
    fileName += '.jpg';
  } else if (ctx.message.document) {
    fileId = ctx.message.document.file_id;
    fileName = ctx.message.document.file_name || fileName;
  }

  if (!fileId) {
    await ctx.reply('Пожалуйста, отправьте изображение вашего рисунка.');
    return;
  }

  // Определяем текущий урок пользователя
  const currentLessonNumber = user.currentLessonDay;
  const lesson = await lessonService.getLesson(currentLessonNumber);

  if (!lesson) {
    await ctx.reply(messages.lessonNotFound);
    return;
  }

  // Проверяем доступ к уроку
  const hasAccess = await lessonService.canAccessLesson(user.id, currentLessonNumber);
  if (!hasAccess) {
    await ctx.reply(messages.needSubscription);
    return;
  }

  try {
    // Скачиваем файл
    const file = await ctx.api.getFile(fileId);
    const filePath = path.join(uploadConfig.path, 'drawings', `${user.id}_${fileName}`);

    // Ensure directory exists
    await drawingService.ensureUploadDirectory();

    // Download file from Telegram
    if (file.file_path) {
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(buffer));

      // Сохраняем в БД
      await drawingService.saveDrawing(user.id, lesson.id, fileId, fileName, filePath);

      await ctx.reply(messages.drawingReceived);
    } else {
      await ctx.reply('Ошибка при загрузке файла. Попробуйте еще раз.');
    }
  } catch (error) {
    console.error('Error saving drawing:', error);
    await ctx.reply('Произошла ошибка при сохранении рисунка. Попробуйте еще раз.');
  }
}

export async function handleDrawingComment(drawingId: string, comment: string, userId: string) {
  const drawing = await drawingService.getDrawing(drawingId);
  if (!drawing) return null;

  return await drawingService.addComment(drawingId, comment, userId);
}
