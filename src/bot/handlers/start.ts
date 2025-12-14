import { Context, InputFile, InlineKeyboard } from 'grammy';
import userService from '../../services/userService';
import lessonService from '../../services/lessonService';
import botSettingsService from '../../services/botSettingsService';
import { createNewbieKeyboard } from '../keyboards';
import { messages } from '../messages';
import path from 'path';
import fs from 'fs';

// Вспомогательная функция для отправки видео
async function sendVideo(ctx: Context, videoUrl: string, caption?: string) {
  // Проверяем, является ли это локальный файл
  const isLocalFile = videoUrl.includes('/uploads/videos/') ||
                       (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://'));

  if (isLocalFile) {
    // Для локальных файлов используем InputFile с защитой от копирования
    const filePath = videoUrl.startsWith('/')
      ? path.join(process.cwd(), videoUrl.substring(1))
      : path.join(process.cwd(), videoUrl);

    await ctx.replyWithVideo(new InputFile(filePath), {
      caption: caption,
      has_spoiler: false,
      supports_streaming: true,
      // Защита от копирования (работает только в каналах/супергруппах, в личке ограничено)
      protect_content: true,
    });
  } else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    // Для YouTube отправляем ссылку с превью
    // Превью автоматически будет кликабельным и откроет видео
    const message = caption ? `${caption}\n\n${videoUrl}` : videoUrl;
    await ctx.reply(message, {
      link_preview_options: {
        is_disabled: false,
        prefer_large_media: true,
        show_above_text: false, // Превью сверху
      },
    });
  } else if (videoUrl.match(/\.(mp4|mov|avi|mkv|webm)(\?.*)?$/i)) {
    // Для прямых ссылок на видео файлы отправляем как видео
    try {
      await ctx.replyWithVideo(videoUrl, {
        caption: caption,
        has_spoiler: false,
        supports_streaming: true,
        protect_content: true,
      });
    } catch (error) {
      // Если не получилось отправить как видео, отправляем как ссылку
      console.error('Error sending video URL:', error);
      await ctx.reply(caption ? `${caption}\n\n${videoUrl}` : videoUrl, {
        link_preview_options: {
          is_disabled: false,
          prefer_large_media: true,
          show_above_text: false,
        },
      });
    }
  } else {
    // Для других ссылок отправляем текст с превью
    await ctx.reply(caption ? `${caption}\n\n${videoUrl}` : videoUrl, {
      link_preview_options: {
        is_disabled: false,
        prefer_large_media: true,
        show_above_text: true,
      },
    });
  }
}

// Обработчик команды /start
export async function handleStart(ctx: Context) {
  if (!ctx.from) return;

  // Создаем или обновляем пользователя
  const user = await userService.findOrCreateUser(
    ctx.from.id,
    ctx.from.username,
    ctx.from.first_name,
    ctx.from.last_name
  );

  const welcomeSettings = await botSettingsService.getWelcomeSettings();

  // ALWAYS show policy on /start if configured
  if (welcomeSettings.policyText) {
    const policyKeyboard = new InlineKeyboard()
      .text(welcomeSettings.policyButton, 'accept_policy');

    await ctx.reply(welcomeSettings.policyText, {
      reply_markup: policyKeyboard,
      parse_mode: 'Markdown',
      link_preview_options: {
        is_disabled: false,
      },
    });
    return;
  }

  // Если политики нет, показываем приветствие
  await showWelcomeScreen(ctx);
}

// Функция для показа экрана приветствия (после принятия политики)
export async function showWelcomeScreen(ctx: Context) {
  if (!ctx.from) return;

  const welcomeSettings = await botSettingsService.getWelcomeSettings();

  // Текст приветствия для всех одинаковый
  const welcomeText = welcomeSettings.welcomeText || messages.welcome;

  // Кнопки показываем ВСЕМ пользователям
  const keyboard = new InlineKeyboard()
    .text(welcomeSettings.welcomeButtonNewbie, 'select_newbie_yes')
    .row()
    .text(welcomeSettings.welcomeButtonExperienced, 'select_newbie_no');

  // Если есть фото, отправляем с фото
  if (welcomeSettings.welcomePhoto) {
    try {
      // Проверяем, это локальный файл или URL
      const isLocalFile = welcomeSettings.welcomePhoto.startsWith('/uploads/');

      if (isLocalFile) {
        const filePath = path.join(process.cwd(), welcomeSettings.welcomePhoto.substring(1));

        // Проверяем существование файла
        if (fs.existsSync(filePath)) {
          await ctx.replyWithPhoto(new InputFile(filePath), {
            caption: welcomeText,
            reply_markup: keyboard,
            parse_mode: 'Markdown',
          });
          return;
        }
      } else {
        // Если это URL
        await ctx.replyWithPhoto(welcomeSettings.welcomePhoto, {
          caption: welcomeText,
          reply_markup: keyboard,
          parse_mode: 'Markdown',
        });
        return;
      }
    } catch (error) {
      console.error('Error sending welcome photo:', error);
      // Если ошибка с фото, отправляем просто текст
    }
  }

  // Если фото нет или была ошибка, отправляем просто текст
  await ctx.reply(welcomeText, {
    reply_markup: keyboard,
    parse_mode: 'Markdown',
  });
}

export async function handleNewbieSelection(ctx: Context, isNewbie: boolean) {
  if (!ctx.from || !ctx.callbackQuery) return;

  const user = await userService.getUserByTelegramId(ctx.from.id);
  if (!user) return;

  // Проверяем, принял ли пользователь политику (если она настроена)
  const welcomeSettings = await botSettingsService.getWelcomeSettings();
  if (welcomeSettings.policyText && !user.acceptedPolicy) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Сначала необходимо принять политику конфиденциальности!',
      show_alert: true,
    });

    // Показываем политику снова
    const policyKeyboard = new InlineKeyboard()
      .text(welcomeSettings.policyButton, 'accept_policy');

    await ctx.reply(welcomeSettings.policyText, {
      reply_markup: policyKeyboard,
      parse_mode: 'Markdown',
      link_preview_options: {
        is_disabled: false,
      },
    });
    return;
  }

  await userService.setUserAsNewbie(user.id, isNewbie);

  await ctx.answerCallbackQuery();

  if (isNewbie) {
    // Получаем только бесплатные уроки
    const freeLessons = await lessonService.getLessonsByType('FREE');

    if (freeLessons && freeLessons.length > 0) {
      // Формируем список бесплатных уроков
      let lessonsList = '📚 *Бесплатные уроки:*\n\n';

      let lessonIndex = 1;
      freeLessons.forEach((lesson) => {
        // Выводим только если есть название или описание
        if (lesson.title || lesson.description) {
          if (lesson.title) {
            lessonsList += `${lessonIndex}. ${lesson.title}\n`;
          }
          if (lesson.description) {
            lessonsList += `   _${lesson.description}_\n`;
          }
          lessonsList += '\n';
          lessonIndex++;
        }
      });

      // Отправляем список уроков БЕЗ кнопки
      await ctx.reply(lessonsList, {
        parse_mode: 'Markdown',
      });

      // Отправляем видео и практику для каждого FREE урока
      for (const lesson of freeLessons) {
        // Отправляем полное видео если есть
        if (lesson.fullVideoUrl) {
          const caption = lesson.title ? `🎬 ${lesson.title}` : '🎬 Полный урок';
          await sendVideo(ctx, lesson.fullVideoUrl, caption);
        }

        // Отправляем видео из LessonVideo если есть
        if (lesson.videos && lesson.videos.length > 0) {
          for (const video of lesson.videos) {
            const caption = `🎥 ${video.title}`;
            await sendVideo(ctx, video.videoUrl, caption);
          }
        }

        // Отправляем текст практики если есть
        if (lesson.practiceText) {
          const practiceMessage = `📝 *Практическое задание*${lesson.title ? ` - ${lesson.title}` : ''}:\n\n${lesson.practiceText}`;
          await ctx.reply(practiceMessage, {
            parse_mode: 'Markdown',
          });
        }
      }

      // Получаем настройки для CTA блока новичков
      const settings = await botSettingsService.getWelcomeSettings();

      // Отправляем кнопку "Хочу в проект" в самом конце
      const keyboard = new InlineKeyboard()
        .text(settings.newbieCtaButton, 'want_to_join_project');

      await ctx.reply(
        settings.newbieCtaText,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
    } else {
      // Если нет FREE уроков, показываем кнопку "Хочу в проект"
      const keyboard = new InlineKeyboard()
        .text('🚀 Хочу в проект', 'want_to_join_project');

      await ctx.reply(
        '🎨 *Добро пожаловать!*\n\n' +
        'Готовы начать обучение? Нажмите кнопку ниже, чтобы присоединиться к проекту!',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
    }
  } else {
    // Не-новички - проверяем подписку и показываем страницу оплаты
    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    if (hasActiveSub) {
      // Если есть подписка, показываем главное меню
      const { createMainMenuKeyboard } = require('../keyboards');
      const mainMenuKeyboard = createMainMenuKeyboard();
      await ctx.reply(
        '✅ У вас уже есть активная подписка!\n\nВыберите действие:',
        { reply_markup: mainMenuKeyboard }
      );
      return;
    }

    // Если нет подписки, показываем страницу оплаты с текстом из админ-панели
    const paymentSettings = await botSettingsService.getPaymentSettings();
    const paymentMethodService = require('../../services/paymentMethodService').default;
    const paymentMethods = await paymentMethodService.getActivePaymentMethods();

    const { InlineKeyboard } = require('grammy');
    const paymentMethodKeyboard = new InlineKeyboard();

    if (paymentMethods.length === 0) {
      await ctx.reply('⚠️ Способы оплаты временно недоступны. Пожалуйста, обратитесь к администратору.');
      return;
    }

    // Добавляем кнопки для каждого метода оплаты (теперь callback вместо URL)
    for (const method of paymentMethods) {
      paymentMethodKeyboard.text(method.buttonText, `pay_${method.id}`).row();
    }

    // Используем текст из настроек админ-панели, если он есть
    const { paymentConfig } = require('../../utils/config');
    let paymentText = paymentSettings.paymentText ||
      `💰 **Стоимость:** ${paymentSettings.paymentPrice || paymentConfig.price} ${paymentSettings.paymentCurrency || paymentConfig.currency}\n` +
      `📅 **Длительность:** ${paymentSettings.paymentDuration || paymentConfig.durationDays} дней\n\n` +
      `Выберите способ оплаты:`;

    // Заменяем [цены] на список всех цен из методов оплаты
    if (paymentText.includes('[цены]')) {
      const pricesList = paymentMethods
        .map((method: any) => {
          const methodPrice = method.price ?? paymentSettings.paymentPrice ?? paymentConfig.price;
          const methodCurrency = method.currency ?? paymentSettings.paymentCurrency ?? paymentConfig.currency;
          return `💰 ${methodPrice} ${methodCurrency}`;
        })
        .join('\n');
      paymentText = paymentText.replace('[цены]', pricesList);
    }

    await ctx.reply(paymentText, {
      parse_mode: 'Markdown',
      reply_markup: paymentMethodKeyboard,
    });
  }
}
