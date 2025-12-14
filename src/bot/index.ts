import { Bot, session, Context, InlineKeyboard } from 'grammy';
import { botConfig, paymentConfig } from '../utils/config';
import { handleStart, handleNewbieSelection, showWelcomeScreen } from './handlers/start';
import { handleDrawingUpload } from './handlers/drawings';
import userService from '../services/userService';
import lessonService from '../services/lessonService';
import paymentService from '../services/paymentService';
import botSettingsService from '../services/botSettingsService';
import paymentMethodService from '../services/paymentMethodService';
import paymentRequestService from '../services/paymentRequestService';
import { createMainMenuKeyboard, createTimeSelectionKeyboard, createPaymentKeyboard } from './keyboards';
import { messages } from './messages';
import { setBotInstance } from './notifications';

export interface SessionData {
  step?: string;
  awaitingDrawing?: boolean;
}

export type BotContext = Context & {
  session: SessionData;
};

export function createBot() {
  const bot = new Bot<BotContext>(botConfig.token);

  // Устанавливаем инстанс бота для уведомлений
  setBotInstance(bot);

  // Session middleware
  bot.use(
    session({
      initial: (): SessionData => ({}),
    })
  );

  // Команда /start
  bot.command('start', handleStart);

  // Команда /reset (для тестирования - сброс статуса пользователя)
  bot.command('reset', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    // Сбрасываем статус новичка напрямую в базе данных
    await userService.resetUserOnboarding(user.id);

    await ctx.reply('✅ Ваш статус сброшен! Теперь вы можете снова пройти онбординг.\n\nИспользуйте /start для начала.');
  });

  // Команда /test_payment (для тестирования - симуляция успешной оплаты)
  bot.command('test_payment', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    // Ищем pending подписки напрямую через Prisma
    const prisma = require('../database/prisma').default;
    const pendingSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!pendingSubscriptions || pendingSubscriptions.length === 0) {
      await ctx.reply(
        '❌ У вас нет ожидающей оплаты подписки.\n\n' +
        'Сначала создайте подписку:\n' +
        '1. Нажмите /menu\n' +
        '2. Выберите "Оплатить подписку"\n' +
        '3. Выберите любой способ оплаты\n' +
        '4. Вернитесь и используйте /test_payment'
      );
      return;
    }

    const pendingSubscription = pendingSubscriptions[0];

    const keyboard = new InlineKeyboard()
      .text('✅ ЮKassa', `test_pay_yukassa_${pendingSubscription.id}`)
      .row()
      .text('✅ Prodamus', `test_pay_prodamus_${pendingSubscription.id}`)
      .row()
      .text('✅ Kaspi', `test_pay_kaspi_${pendingSubscription.id}`)
      .row()
      .text('❌ Отмена', 'test_pay_cancel');

    await ctx.reply(
      `🧪 **Тестовая оплата**\n\n` +
      `Найдена pending подписка:\n` +
      `ID: \`${pendingSubscription.id.substring(0, 8)}...\`\n` +
      `Сумма: ${pendingSubscription.price} ${pendingSubscription.currency}\n` +
      `Провайдер: ${pendingSubscription.paymentProvider}\n\n` +
      `Выберите платежную систему для симуляции успешной оплаты:`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  });

  // Команда /menu
  bot.command('menu', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    if (!hasActiveSub) {
      const paymentKeyboard = new InlineKeyboard()
        .text('💳 Оплатить подписку', 'show_payment');

      await ctx.reply(
        '🔒 Для доступа к главному меню необходима активная подписка.\n\n' +
        'Оплатите подписку, чтобы получить доступ ко всем функциям бота.',
        {
          reply_markup: paymentKeyboard,
        }
      );
      return;
    }

    await ctx.reply('Главное меню:', {
      reply_markup: createMainMenuKeyboard(),
    });
  });

  // Обработка согласия с политикой
  bot.callbackQuery('accept_policy', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    // Отмечаем, что пользователь принял политику
    await userService.acceptPolicy(user.id);

    await ctx.answerCallbackQuery();

    // Показываем экран приветствия (без повторной проверки политики)
    await showWelcomeScreen(ctx);
  });

  // Обработка выбора "новичок или нет"
  bot.callbackQuery('select_newbie_yes', async (ctx) => {
    await handleNewbieSelection(ctx, true);
  });

  bot.callbackQuery('select_newbie_no', async (ctx) => {
    await handleNewbieSelection(ctx, false);
  });

  // Обработка кнопки "Хочу в проект"
  bot.callbackQuery('want_to_join_project', async (ctx) => {
    if (!ctx.from) return;

    // Проверяем принятие политики
    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    const welcomeSettings = await botSettingsService.getWelcomeSettings();
    if (welcomeSettings.policyText && !user.acceptedPolicy) {
      await ctx.answerCallbackQuery({
        text: '⚠️ Сначала необходимо принять политику конфиденциальности!',
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery();

    // Проверяем, есть ли у пользователя активная подписка
    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    if (hasActiveSub) {
      // Если есть подписка, показываем главное меню
      const mainMenuKeyboard = createMainMenuKeyboard();
      await ctx.reply(
        '✅ У вас уже есть активная подписка!\n\nВыберите действие:',
        { reply_markup: mainMenuKeyboard }
      );
      return;
    }

    // Если нет подписки, показываем страницу оплаты
    // Загружаем настройки оплаты
    const paymentSettings = await botSettingsService.getPaymentSettings();

    // Загружаем активные методы оплаты из базы данных
    const paymentMethods = await paymentMethodService.getActivePaymentMethods();

    // Создаем клавиатуру с динамическими кнопками
    const paymentMethodKeyboard = new InlineKeyboard();

    if (paymentMethods.length === 0) {
      // Если методов нет, показываем сообщение
      await ctx.reply(
        '⚠️ Способы оплаты временно недоступны. Пожалуйста, обратитесь к администратору.',
      );
      return;
    }

    // Добавляем кнопки для каждого метода оплаты (callback вместо URL)
    for (const method of paymentMethods) {
      paymentMethodKeyboard.text(method.buttonText, `pay_${method.id}`).row();
    }

    // Используем текст из настроек админ-панели, если он есть
    let paymentText = paymentSettings.paymentText ||
      `🎨 **Присоединяйтесь к проекту!**\n\n` +
      `💰 **Стоимость:** ${paymentSettings.paymentPrice || paymentConfig.price} ${paymentSettings.paymentCurrency || paymentConfig.currency}\n` +
      `📅 **Длительность:** ${paymentSettings.paymentDuration || paymentConfig.durationDays} дней\n\n` +
      `Выберите способ оплаты:`;

    // Заменяем [цены] на список всех цен из методов оплаты
    if (paymentText.includes('[цены]')) {
      const pricesList = paymentMethods
        .map(method => {
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
  });

  // Обработка выбора времени
  bot.callbackQuery(/^time_(.+)$/, async (ctx) => {
    const time = ctx.match[1];
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    await userService.setPreferredTime(user.id, time);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(messages.timeSelected(time));
  });

  // Главное меню - Мои уроки
  bot.callbackQuery('my_lessons', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    await ctx.answerCallbackQuery();

    if (!hasActiveSub) {
      const paymentKeyboard = new InlineKeyboard()
        .text('💳 Оплатить подписку', 'show_payment');

      await ctx.editMessageText(
        '🔒 Для доступа к урокам необходима активная подписка.',
        {
          reply_markup: paymentKeyboard,
        }
      );
      return;
    }

    const lessons = await lessonService.getAllLessons();
    let response = '📚 **Ваши уроки:**\n\n';

    for (const lesson of lessons) {
      const hasAccess = await lessonService.canAccessLesson(user.id, lesson.lessonNumber);
      const status = hasAccess ? '✅' : '🔒';
      const current = user.currentLessonDay === lesson.lessonNumber ? '👉 ' : '';
      response += `${current}${status} Урок ${lesson.lessonNumber}: ${lesson.title}\n`;
    }

    const backKeyboard = new InlineKeyboard().text('◀️ Назад', 'main_menu');

    await ctx.editMessageText(response, {
      parse_mode: 'Markdown',
      reply_markup: backKeyboard,
    });
  });

  // Главное меню - Изменить время
  bot.callbackQuery('change_time', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    await ctx.answerCallbackQuery();

    if (!hasActiveSub) {
      const paymentKeyboard = new InlineKeyboard()
        .text('💳 Оплатить подписку', 'show_payment')
        .row()
        .text('◀️ Назад', 'main_menu');

      await ctx.editMessageText(
        '🔒 Для изменения времени необходима активная подписка.',
        {
          reply_markup: paymentKeyboard,
        }
      );
      return;
    }

    await ctx.editMessageText('⏰ Выберите новое время для получения уроков:', {
      reply_markup: createTimeSelectionKeyboard(),
    });
  });

  // Главное меню - О курсе
  bot.callbackQuery('about_course', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    await ctx.answerCallbackQuery();

    if (!hasActiveSub) {
      const paymentKeyboard = new InlineKeyboard()
        .text('💳 Оплатить подписку', 'show_payment')
        .row()
        .text('◀️ Назад', 'main_menu');

      await ctx.editMessageText(
        '🔒 Для доступа к информации о курсе необходима активная подписка.',
        {
          reply_markup: paymentKeyboard,
        }
      );
      return;
    }

    const backKeyboard = new InlineKeyboard().text('◀️ Назад', 'main_menu');

    await ctx.editMessageText(messages.aboutCourse, {
      parse_mode: 'Markdown',
      reply_markup: backKeyboard,
    });
  });

  // Главное меню - Подписка
  bot.callbackQuery('subscription_info', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    if (hasActiveSub) {
      const sub = user.subscriptions.find(
        (s: any) => s.status === 'completed' && s.endDate && s.endDate >= new Date()
      );

      if (sub && sub.endDate) {
        const daysLeft = Math.ceil(
          (sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const backKeyboard = new InlineKeyboard().text('◀️ Назад', 'main_menu');

        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          `✅ У вас активная подписка\n\nОсталось дней: ${daysLeft}\nДействует до: ${sub.endDate.toLocaleDateString()}`,
          {
            reply_markup: backKeyboard,
          }
        );
      }
    } else {
      await ctx.answerCallbackQuery();

      const paymentKeyboard = new InlineKeyboard()
        .text('💳 Оплатить подписку', 'show_payment')
        .row()
        .text('◀️ Назад', 'main_menu');

      await ctx.editMessageText(messages.noActiveSub, {
        reply_markup: paymentKeyboard,
      });
    }
  });

  // Показать варианты оплаты
  bot.callbackQuery('show_payment', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    // Проверяем принятие политики
    const welcomeSettings = await botSettingsService.getWelcomeSettings();
    if (welcomeSettings.policyText && !user.acceptedPolicy) {
      await ctx.answerCallbackQuery({
        text: '⚠️ Сначала необходимо принять политику конфиденциальности!',
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery();

    // Загружаем настройки оплаты
    const paymentSettings = await botSettingsService.getPaymentSettings();

    // Загружаем активные методы оплаты из базы данных
    const paymentMethods = await paymentMethodService.getActivePaymentMethods();

    // Создаем клавиатуру с динамическими кнопками
    const paymentMethodKeyboard = new InlineKeyboard();

    if (paymentMethods.length === 0) {
      // Если методов нет, показываем сообщение
      await ctx.editMessageText(
        '⚠️ Способы оплаты временно недоступны. Пожалуйста, обратитесь к администратору.',
        {
          reply_markup: new InlineKeyboard().text('◀️ Назад', 'main_menu'),
        }
      );
      return;
    }

    // Добавляем кнопки для каждого метода оплаты (callback вместо URL)
    for (const method of paymentMethods) {
      paymentMethodKeyboard.text(method.buttonText, `pay_${method.id}`).row();
    }

    // Используем текст из настроек админ-панели, если он есть
    let paymentText = paymentSettings.paymentText ||
      `💰 **Стоимость:** ${paymentSettings.paymentPrice || paymentConfig.price} ${paymentSettings.paymentCurrency || paymentConfig.currency}\n` +
      `📅 **Длительность:** ${paymentSettings.paymentDuration || paymentConfig.durationDays} дней\n\n` +
      `Выберите способ оплаты:`;

    // Заменяем [цены] на список всех цен из методов оплаты
    if (paymentText.includes('[цены]')) {
      const pricesList = paymentMethods
        .map(method => {
          const methodPrice = method.price ?? paymentSettings.paymentPrice ?? paymentConfig.price;
          const methodCurrency = method.currency ?? paymentSettings.paymentCurrency ?? paymentConfig.currency;
          return `💰 ${methodPrice} ${methodCurrency}`;
        })
        .join('\n');
      paymentText = paymentText.replace('[цены]', pricesList);
    }

    await ctx.editMessageText(paymentText, {
      parse_mode: 'Markdown',
      reply_markup: paymentMethodKeyboard,
    });
  });

  // Обработчик нажатия на кнопку оплаты
  bot.callbackQuery(/^pay_(.+)$/,async (ctx) => {
    if (!ctx.from) return;

    const paymentMethodId = ctx.match[1];

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    // Проверяем, есть ли уже pending-платежка у пользователя
    const existingPendingRequests = await paymentRequestService.getUserPendingRequests(user.id);

    let paymentRequest;
    let paymentMethod;
    let methodPrice;
    let methodCurrency;
    let finalUrl;
    let paymentSettings;

    if (existingPendingRequests.length > 0) {
      // Используем существующую pending-платежку
      paymentRequest = existingPendingRequests[0];
      paymentMethod = await paymentMethodService.getPaymentMethod(paymentRequest.paymentMethodId);

      if (!paymentMethod) {
        await ctx.answerCallbackQuery({
          text: '⚠️ Метод оплаты не найден',
          show_alert: true,
        });
        return;
      }

      methodPrice = paymentRequest.price;
      methodCurrency = paymentRequest.currency;
      finalUrl = paymentRequest.paymentUrl;
      paymentSettings = await botSettingsService.getPaymentSettings();
    } else {
      // Создаём новую заявку на оплату
      paymentMethod = await paymentMethodService.getPaymentMethod(paymentMethodId);
      if (!paymentMethod) {
        await ctx.answerCallbackQuery({
          text: '⚠️ Метод оплаты не найден',
          show_alert: true,
        });
        return;
      }

      // Получаем настройки для определения цены
      paymentSettings = await botSettingsService.getPaymentSettings();
      methodPrice = paymentMethod.price ?? paymentSettings.paymentPrice ?? paymentConfig.price;
      methodCurrency = paymentMethod.currency ?? paymentSettings.paymentCurrency ?? paymentConfig.currency;
      finalUrl = paymentMethod.paymentUrl.replace('{price}', methodPrice.toString());

      paymentRequest = await paymentRequestService.createPaymentRequest({
        userId: user.id,
        paymentMethodId: paymentMethod.id,
        price: methodPrice,
        currency: methodCurrency,
        paymentMethodName: paymentMethod.name,
        paymentUrl: finalUrl,
      });
    }

    await ctx.answerCallbackQuery();

    // Отправляем уведомление администратору только если заявка новая и не уведомленная
    console.log('🔍 DEBUG: Checking notification conditions...');
    console.log('  - existingPendingRequests.length:', existingPendingRequests.length);
    console.log('  - paymentSettings.adminTelegramId:', paymentSettings.adminTelegramId);
    console.log('  - Should send notification:', existingPendingRequests.length === 0 && paymentSettings.adminTelegramId);

    if (existingPendingRequests.length === 0 && paymentSettings.adminTelegramId) {
      try {
        console.log('📤 Attempting to send admin notification...');

        const adminKeyboard = new InlineKeyboard()
          .text('✅ Подтвердить', `confirm_payment_${paymentRequest.id}`)
          .text('❌ Отклонить', `reject_payment_${paymentRequest.id}`);

        const username = user.username ? `@${user.username}` : user.firstName || 'Пользователь';
        const userInfo = user.firstName
          ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
          : 'Без имени';

        const adminMessage =
          `🔔 <b>Новая заявка на оплату</b> #${paymentRequest.id.slice(-8)}\n\n` +
          `👤 <b>Пользователь:</b> ${username}\n` +
          `📝 <b>Имя:</b> ${userInfo}\n` +
          `💰 <b>Сумма:</b> ${methodPrice} ${methodCurrency}\n` +
          `📦 <b>Способ:</b> ${paymentMethod.name}\n` +
          `🔗 <b>Ссылка:</b> ${finalUrl}\n` +
          `⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`;

        console.log('📨 Sending message to admin:', paymentSettings.adminTelegramId);

        await ctx.api.sendMessage(paymentSettings.adminTelegramId, adminMessage, {
          parse_mode: 'HTML',
          reply_markup: adminKeyboard,
        });

        console.log('✅ Admin notification sent successfully!');

        await paymentRequestService.markAsNotified(paymentRequest.id);
      } catch (error) {
        console.error('❌ Error sending admin notification:', error);
      }
    } else {
      console.log('⏭️ Skipping notification - either existing request or no admin ID configured');
    }

    // Показываем пользователю сообщение с ссылкой на оплату и статусом
    const userKeyboard = new InlineKeyboard()
      .url('💳 Перейти к оплате', finalUrl)
      .row()
      .text('◀️ Назад', 'show_payment');

    await ctx.editMessageText(
      `⏳ **Ожидается подтверждение оплаты**\n\n` +
      `Вы выбрали способ оплаты: **${paymentMethod.name}**\n` +
      `Сумма: **${methodPrice} ${methodCurrency}**\n\n` +
      `Перейдите по ссылке ниже для оплаты. После оплаты администратор подтвердит платёж, и вам придёт уведомление.`,
      {
        parse_mode: 'Markdown',
        reply_markup: userKeyboard,
      }
    );
  });

  // Проверка оплаты
  bot.callbackQuery('payment_check', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    await ctx.answerCallbackQuery('Проверяем статус платежа...');

    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    if (hasActiveSub) {
      await ctx.editMessageText(
        '✅ **Оплата подтверждена!**\n\n' +
        'Ваша подписка активирована. Теперь выберите удобное время для получения уроков:',
        {
          parse_mode: 'Markdown',
          reply_markup: createTimeSelectionKeyboard(),
        }
      );
    } else {
      await ctx.answerCallbackQuery({
        text: '⏳ Платеж еще не подтвержден. Подождите немного и попробуйте снова.',
        show_alert: true,
      });
    }
  });

  // Отказ от оплаты
  bot.callbackQuery('payment_decline', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      'Вы можете оформить подписку позже через меню.',
      {
        reply_markup: new InlineKeyboard().text('🏠 Главное меню', 'main_menu'),
      }
    );
  });

  // Подтверждение оплаты администратором
  bot.callbackQuery(/^confirm_payment_(.+)$/, async (ctx) => {
    if (!ctx.from) return;

    const paymentRequestId = ctx.match[1];

    // Получаем заявку
    const paymentRequest = await paymentRequestService.getPaymentRequest(paymentRequestId);
    if (!paymentRequest) {
      await ctx.answerCallbackQuery({
        text: '⚠️ Заявка не найдена',
        show_alert: true,
      });
      return;
    }

    if (paymentRequest.status !== 'pending') {
      await ctx.answerCallbackQuery({
        text: `⚠️ Заявка уже обработана (статус: ${paymentRequest.status})`,
        show_alert: true,
      });
      return;
    }

    // Подтверждаем заявку
    await paymentRequestService.confirmPaymentRequest(paymentRequestId, ctx.from.id.toString());

    // Создаём подписку для пользователя
    const paymentSettings = await botSettingsService.getPaymentSettings();
    const durationDays = paymentSettings.paymentDuration || 30;

    await paymentService.createManualSubscription(
      paymentRequest.userId,
      durationDays
    );

    await ctx.answerCallbackQuery('✅ Оплата подтверждена!');

    // Обновляем сообщение администратора
    await ctx.editMessageText(
      ctx.msg?.text + '\n\n✅ <b>Подтверждено</b> администратором',
      { parse_mode: 'HTML' }
    );

    // Уведомляем пользователя
    try {
      await ctx.api.sendMessage(
        paymentRequest.user.telegramId.toString(),
        `✅ **Оплата подтверждена!**\n\n` +
        `Ваша подписка активирована на ${durationDays} дней.\n` +
        `Теперь у вас есть доступ ко всем урокам!`,
        { parse_mode: 'Markdown', reply_markup: createMainMenuKeyboard() }
      );
    } catch (error) {
      console.error('Error notifying user:', error);
    }
  });

  // Отклонение оплаты администратором
  bot.callbackQuery(/^reject_payment_(.+)$/, async (ctx) => {
    if (!ctx.from) return;

    const paymentRequestId = ctx.match[1];

    // Получаем заявку
    const paymentRequest = await paymentRequestService.getPaymentRequest(paymentRequestId);
    if (!paymentRequest) {
      await ctx.answerCallbackQuery({
        text: '⚠️ Заявка не найдена',
        show_alert: true,
      });
      return;
    }

    if (paymentRequest.status !== 'pending') {
      await ctx.answerCallbackQuery({
        text: `⚠️ Заявка уже обработана (статус: ${paymentRequest.status})`,
        show_alert: true,
      });
      return;
    }

    // Отклоняем заявку
    await paymentRequestService.rejectPaymentRequest(paymentRequestId, ctx.from.id.toString());

    await ctx.answerCallbackQuery('❌ Оплата отклонена');

    // Обновляем сообщение администратора
    await ctx.editMessageText(
      ctx.msg?.text + '\n\n❌ <b>Отклонено</b> администратором',
      { parse_mode: 'HTML' }
    );

    // Уведомляем пользователя
    try {
      await ctx.api.sendMessage(
        paymentRequest.user.telegramId.toString(),
        `❌ **Оплата отклонена**\n\n` +
        `К сожалению, ваша заявка на оплату была отклонена.\n` +
        `Пожалуйста, свяжитесь с администратором для уточнения деталей.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Error notifying user:', error);
    }
  });

  // Тестовая оплата - отмена
  bot.callbackQuery('test_pay_cancel', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('❌ Тестовая оплата отменена.');
  });

  // Тестовая оплата - ЮKassa
  bot.callbackQuery(/^test_pay_yukassa_(.+)$/, async (ctx) => {
    const subscriptionId = ctx.match[1];
    await ctx.answerCallbackQuery('⏳ Обработка...');

    try {
      await ctx.editMessageText('⏳ Симуляция успешной оплаты через ЮKassa...');

      // Вызываем тестовый endpoint
      const adminSecret = process.env.ADMIN_SECRET || '';
      const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000';

      const response = await fetch(`${webhookUrl}/api/test/yukassa/success`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to process test payment');
      }

      await ctx.editMessageText(
        '✅ **Тестовая оплата успешна!**\n\n' +
        'Платежная система: ЮKassa\n' +
        'Статус: Оплачено\n\n' +
        'Ваша подписка активирована! 🎉'
      );

      // Отправляем клавиатуру выбора времени
      setTimeout(async () => {
        await ctx.reply(
          '⏰ Выберите удобное время для получения ежедневных уроков:',
          {
            reply_markup: createTimeSelectionKeyboard(),
          }
        );
      }, 1000);

    } catch (error) {
      console.error('Test payment error:', error);
      await ctx.editMessageText(
        '❌ Ошибка при обработке тестовой оплаты.\n\n' +
        'Попробуйте использовать админ-панель или свяжитесь с поддержкой.'
      );
    }
  });

  // Тестовая оплата - Prodamus
  bot.callbackQuery(/^test_pay_prodamus_(.+)$/, async (ctx) => {
    const subscriptionId = ctx.match[1];
    await ctx.answerCallbackQuery('⏳ Обработка...');

    try {
      await ctx.editMessageText('⏳ Симуляция успешной оплаты через Prodamus...');

      const adminSecret = process.env.ADMIN_SECRET || '';
      const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000';

      const response = await fetch(`${webhookUrl}/api/test/prodamus/success`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to process test payment');
      }

      await ctx.editMessageText(
        '✅ **Тестовая оплата успешна!**\n\n' +
        'Платежная система: Prodamus\n' +
        'Статус: Оплачено\n\n' +
        'Ваша подписка активирована! 🎉'
      );

      setTimeout(async () => {
        await ctx.reply(
          '⏰ Выберите удобное время для получения ежедневных уроков:',
          {
            reply_markup: createTimeSelectionKeyboard(),
          }
        );
      }, 1000);

    } catch (error) {
      console.error('Test payment error:', error);
      await ctx.editMessageText(
        '❌ Ошибка при обработке тестовой оплаты.\n\n' +
        'Попробуйте использовать админ-панель или свяжитесь с поддержкой.'
      );
    }
  });

  // Тестовая оплата - Kaspi
  bot.callbackQuery(/^test_pay_kaspi_(.+)$/, async (ctx) => {
    const subscriptionId = ctx.match[1];
    await ctx.answerCallbackQuery('⏳ Обработка...');

    try {
      await ctx.editMessageText('⏳ Симуляция успешной оплаты через Kaspi...');

      const adminSecret = process.env.ADMIN_SECRET || '';
      const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000';

      const response = await fetch(`${webhookUrl}/api/test/kaspi/success`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to process test payment');
      }

      await ctx.editMessageText(
        '✅ **Тестовая оплата успешна!**\n\n' +
        'Платежная система: Kaspi\n' +
        'Статус: Оплачено\n\n' +
        'Ваша подписка активирована! 🎉'
      );

      setTimeout(async () => {
        await ctx.reply(
          '⏰ Выберите удобное время для получения ежедневных уроков:',
          {
            reply_markup: createTimeSelectionKeyboard(),
          }
        );
      }, 1000);

    } catch (error) {
      console.error('Test payment error:', error);
      await ctx.editMessageText(
        '❌ Ошибка при обработке тестовой оплаты.\n\n' +
        'Попробуйте использовать админ-панель или свяжитесь с поддержкой.'
      );
    }
  });

  // Возврат в главное меню
  bot.callbackQuery('main_menu', async (ctx) => {
    if (!ctx.from) return;

    const user = await userService.getUserByTelegramId(ctx.from.id);
    if (!user) return;

    const hasActiveSub = await userService.hasActiveSubscription(user.id);

    await ctx.answerCallbackQuery();

    if (!hasActiveSub) {
      const paymentKeyboard = new InlineKeyboard()
        .text('💳 Оплатить подписку', 'show_payment');

      await ctx.editMessageText(
        '🔒 Для доступа к главному меню необходима активная подписка.\n\n' +
        'Оплатите подписку, чтобы получить доступ ко всем функциям бота.',
        {
          reply_markup: paymentKeyboard,
        }
      );
      return;
    }

    await ctx.editMessageText('Главное меню:', {
      reply_markup: createMainMenuKeyboard(),
    });
  });

  // Обработка фото и документов (рисунков)
  bot.on(['message:photo', 'message:document'], handleDrawingUpload);

  // Обработка ошибок
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  // Устанавливаем команды бота (отображаются в меню)
  bot.api.setMyCommands([
    { command: 'menu', description: '📋 Главное меню' },
  ]).catch((err) => {
    console.error('Error setting bot commands:', err);
  });

  return bot;
}
