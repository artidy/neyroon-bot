import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { botConfig } from '../utils/config';
import userService from '../services/userService';
import lessonService from '../services/lessonService';
import drawingService from '../services/drawingService';
import paymentService from '../services/paymentService';
import botSettingsService from '../services/botSettingsService';
import paymentMethodService from '../services/paymentMethodService';
import paymentRequestService from '../services/paymentRequestService';
import prisma from '../database/prisma';
import { sendPaymentSuccessNotification, sendPaymentFailedNotification, sendManualSubscriptionNotification, getBotInstance } from '../bot/notifications';
import { InlineKeyboard } from 'grammy';

// Helper function to convert BigInt to string in nested objects
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = serializeBigInt(obj[key]);
    }
    return result;
  }

  return obj;
}

// Настройка multer для загрузки видео
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `video-${uniqueSuffix}${ext}`);
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только видео файлы разрешены!'));
    }
  }
});

export function createAdminServer() {
  const app = express();

  // CORS middleware - разрешаем доступ из локальной сети
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Обработка preflight запросов
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/admin', express.static(path.join(process.cwd(), 'admin-panel')));

  // Health check endpoint (для Docker healthcheck)
  app.get('/health', async (req, res) => {
    try {
      // Проверяем подключение к БД
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'neyroon-bot'
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed'
      });
    }
  });

  // Basic auth middleware (простая проверка, для продакшена нужно JWT)
  const authMiddleware = (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  };

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Stats endpoint
  app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
      const userStats = await userService.getUserStats();
      const paymentStats = await paymentService.getPaymentStats();
      const drawingStats = await drawingService.getDrawingStats();

      res.json({
        users: userStats,
        payments: paymentStats,
        drawings: drawingStats,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Users endpoints
  app.get('/api/users', authMiddleware, async (req, res) => {
    try {
      const users = await userService.getAllUsers();
      res.json(serializeBigInt(users));
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/users/:telegramId', authMiddleware, async (req, res) => {
    try {
      const user = await userService.getUserByTelegramId(parseInt(req.params.telegramId));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(serializeBigInt(user));
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Lessons endpoints
  app.get('/api/lessons', authMiddleware, async (req, res) => {
    try {
      const lessons = await lessonService.getAllLessons();
      res.json(lessons);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/lessons/:lessonNumber', authMiddleware, async (req, res) => {
    try {
      const lesson = await lessonService.getLesson(parseInt(req.params.lessonNumber));
      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      res.json(lesson);
    } catch (error) {
      console.error('Error fetching lesson:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Создать новый урок
  app.post('/api/lessons', authMiddleware, async (req, res) => {
    try {
      const { lessonNumber, type, title, description, previewVideoUrl, fullVideoUrl, practiceText, order, isActive } = req.body;

      if (!lessonNumber || !type) {
        return res.status(400).json({ error: 'lessonNumber and type are required' });
      }

      const lesson = await prisma.lesson.create({
        data: {
          lessonNumber: parseInt(lessonNumber),
          type,
          title: title || null,
          description: description || null,
          previewVideoUrl: previewVideoUrl || null,
          fullVideoUrl: fullVideoUrl || null,
          practiceText: practiceText || null,
          order: parseInt(order) || 0,
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      res.json(lesson);
    } catch (error: any) {
      console.error('Error creating lesson:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Lesson with this number already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/lessons/:lessonNumber', authMiddleware, async (req, res) => {
    try {
      console.log('Updating lesson:', req.params.lessonNumber);
      console.log('Request body:', JSON.stringify(req.body, null, 2));

      const updated = await lessonService.updateLesson(
        parseInt(req.params.lessonNumber),
        req.body
      );

      console.log('Updated lesson:', JSON.stringify(updated, null, 2));
      res.json(updated);
    } catch (error) {
      console.error('Error updating lesson:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Удалить урок
  app.delete('/api/lessons/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      // Удаляем урок (каскадное удаление удалит связанные видео и рисунки)
      await prisma.lesson.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Lesson deleted' });
    } catch (error: any) {
      console.error('Error deleting lesson:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Drawings endpoints
  app.get('/api/drawings', authMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await drawingService.getAllDrawings(page, limit);
      res.json(serializeBigInt(result));
    } catch (error) {
      console.error('Error fetching drawings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/drawings/uncommented', authMiddleware, async (req, res) => {
    try {
      const drawings = await drawingService.getUncommentedDrawings();
      res.json(serializeBigInt(drawings));
    } catch (error) {
      console.error('Error fetching uncommented drawings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/drawings/:id/comment', authMiddleware, async (req, res) => {
    try {
      const { comment, commentedBy } = req.body;

      if (!comment) {
        return res.status(400).json({ error: 'Comment is required' });
      }

      const updated = await drawingService.addComment(
        req.params.id,
        comment,
        commentedBy || 'admin'
      );

      res.json(serializeBigInt(updated));
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Payments endpoints
  app.get('/api/payments/active', authMiddleware, async (req, res) => {
    try {
      const subscriptions = await paymentService.getActiveSubscriptions();
      res.json(serializeBigInt(subscriptions));
    } catch (error) {
      console.error('Error fetching active subscriptions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get all pending payments
  app.get('/api/payments/pending', authMiddleware, async (req, res) => {
    try {
      const pendingPayments = await prisma.subscription.findMany({
        where: {
          status: 'pending',
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      res.json(serializeBigInt(pendingPayments));
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get all payment requests
  app.get('/api/payment-requests', authMiddleware, async (req, res) => {
    try {
      const paymentRequests = await paymentRequestService.getAllPaymentRequests();
      res.json(serializeBigInt(paymentRequests));
    } catch (error) {
      console.error('Error fetching payment requests:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Notify admin about payment request
  app.post('/api/payment-requests/:requestId/notify-admin', authMiddleware, async (req, res) => {
    try {
      const { requestId } = req.params;

      const paymentRequest = await paymentRequestService.getPaymentRequest(requestId);
      if (!paymentRequest) {
        return res.status(404).json({ error: 'Payment request not found' });
      }

      const paymentSettings = await botSettingsService.getPaymentSettings();
      if (!paymentSettings.adminTelegramId) {
        return res.status(400).json({ error: 'Admin Telegram ID not configured' });
      }

      // Получаем инстанс бота
      const bot = getBotInstance();
      if (!bot) {
        return res.status(500).json({ error: 'Bot instance not available' });
      }

      const adminKeyboard = new InlineKeyboard()
        .text('✅ Подтвердить', `confirm_payment_${paymentRequest.id}`)
        .text('❌ Отклонить', `reject_payment_${paymentRequest.id}`);

      const username = paymentRequest.user.username ? `@${paymentRequest.user.username}` : paymentRequest.user.firstName || 'Пользователь';
      const userInfo = paymentRequest.user.firstName
        ? `${paymentRequest.user.firstName}${paymentRequest.user.lastName ? ' ' + paymentRequest.user.lastName : ''}`
        : 'Без имени';

      const adminMessage =
        `🔔 <b>Новая заявка на оплату</b> #${paymentRequest.id.slice(-8)}\n\n` +
        `👤 <b>Пользователь:</b> ${username}\n` +
        `📝 <b>Имя:</b> ${userInfo}\n` +
        `💰 <b>Сумма:</b> ${paymentRequest.price} ${paymentRequest.currency}\n` +
        `📦 <b>Способ:</b> ${paymentRequest.paymentMethodName}\n` +
        `🔗 <b>Ссылка:</b> ${paymentRequest.paymentUrl}\n` +
        `⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`;

      await bot.api.sendMessage(paymentSettings.adminTelegramId, adminMessage, {
        parse_mode: 'HTML',
        reply_markup: adminKeyboard,
      });

      await paymentRequestService.markAsNotified(paymentRequest.id);

      res.json({ success: true, message: 'Admin notified successfully' });
    } catch (error) {
      console.error('Error notifying admin:', error);
      res.status(500).json({ error: 'Failed to notify admin' });
    }
  });

  // Manually confirm payment
  app.post('/api/payments/:subscriptionId/confirm', authMiddleware, async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const { paymentId } = req.body;

      // Подтверждаем платеж
      const subscription = await paymentService.confirmPayment(
        subscriptionId,
        paymentId || `MANUAL-${Date.now()}`
      );

      // Отправляем уведомление пользователю
      if (subscription?.user?.telegramId) {
        await sendPaymentSuccessNotification(subscription.user.telegramId);
        console.log(`Payment manually confirmed for user ${subscription.user.telegramId}`);
      }

      res.json({
        success: true,
        message: 'Payment confirmed manually',
        subscription: serializeBigInt(subscription),
      });
    } catch (error) {
      console.error('Error confirming payment manually:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create manual subscription
  app.post('/api/users/:userId/subscription', authMiddleware, async (req, res) => {
    try {
      const { durationDays } = req.body;

      if (!durationDays || durationDays <= 0) {
        return res.status(400).json({ error: 'Duration days is required and must be positive' });
      }

      const subscription = await paymentService.createManualSubscription(
        req.params.userId,
        parseInt(durationDays)
      );

      // Отправляем уведомление пользователю
      if (subscription?.user?.telegramId) {
        await sendManualSubscriptionNotification(
          subscription.user.telegramId,
          parseInt(durationDays)
        );
      }

      res.json(serializeBigInt(subscription));
    } catch (error) {
      console.error('Error creating manual subscription:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete payment request
  app.delete('/api/payment-requests/:requestId', authMiddleware, async (req, res) => {
    try {
      const { requestId } = req.params;
      await paymentRequestService.deletePaymentRequest(requestId);
      res.json({ success: true, message: 'Payment request deleted successfully' });
    } catch (error) {
      console.error('Error deleting payment request:', error);
      res.status(500).json({ error: 'Failed to delete payment request' });
    }
  });

  // Delete subscription
  app.delete('/api/subscriptions/:subscriptionId', authMiddleware, async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      await paymentService.deleteSubscription(subscriptionId);
      res.json({ success: true, message: 'Subscription deleted successfully' });
    } catch (error) {
      console.error('Error deleting subscription:', error);
      res.status(500).json({ error: 'Failed to delete subscription' });
    }
  });

  // Video upload endpoint
  app.post('/api/upload/video', authMiddleware, videoUpload.single('video'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Видео файл не загружен' });
      }

      const videoPath = `/uploads/videos/${req.file.filename}`;

      res.json({
        success: true,
        path: videoPath,
        filename: req.file.filename,
        size: req.file.size,
      });
    } catch (error) {
      console.error('Error uploading video:', error);
      res.status(500).json({ error: 'Ошибка при загрузке видео' });
    }
  });

  // Kaspi.kz Payment Webhook (no auth - called by Kaspi servers)
  app.post('/api/payments/kaspi/webhook', async (req, res) => {
    try {
      const { payment_id, status, order_id, amount, metadata } = req.body;

      console.log('Kaspi webhook received:', {
        payment_id,
        status,
        order_id,
        amount,
      });

      // Проверяем подпись запроса от Kaspi (для безопасности)
      // const signature = req.headers['x-kaspi-signature'];
      // if (!verifyKaspiSignature(req.body, signature)) {
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }

      if (status === 'success' || status === 'completed') {
        // Платеж успешно завершен
        const subscription = await paymentService.confirmPayment(order_id, payment_id);

        // Отправляем уведомление пользователю через бота
        if (subscription?.user?.telegramId) {
          await sendPaymentSuccessNotification(subscription.user.telegramId);
          console.log(`Payment confirmed for user ${subscription.user.telegramId}`);
        }

        res.json({ success: true, message: 'Payment confirmed' });
      } else if (status === 'failed' || status === 'cancelled') {
        // Платеж не прошел
        console.log(`Payment ${payment_id} failed or cancelled`);

        // Получаем информацию о подписке для отправки уведомления
        const subscription = await paymentService.checkPaymentStatus(order_id);
        if (subscription) {
          const user = await userService.getUserByTelegramId(Number(subscription.userId));
          if (user?.telegramId) {
            await sendPaymentFailedNotification(user.telegramId);
          }
        }

        res.json({ success: true, message: 'Payment status updated' });
      } else {
        // Промежуточный статус (pending, processing и т.д.)
        res.json({ success: true, message: 'Payment status received' });
      }
    } catch (error) {
      console.error('Error processing Kaspi webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Prodamus Payment Webhook (no auth - called by Prodamus servers)
  app.post('/api/payments/prodamus/webhook', async (req, res) => {
    try {
      const { order_id, order_num, payment_status, customer_phone } = req.body;

      console.log('Prodamus webhook received:', {
        order_id,
        order_num,
        payment_status,
        customer_phone,
      });

      // Проверяем подпись запроса от Prodamus (для безопасности)
      // const signature = req.headers['sign'];
      // if (!verifyProdamusSignature(req.body, signature)) {
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }

      if (payment_status === 'success' || payment_status === 'paid') {
        // Платеж успешно завершен
        const subscription = await paymentService.confirmPayment(order_id, order_num || `PRODAMUS-${Date.now()}`);

        // Отправляем уведомление пользователю через бота
        if (subscription?.user?.telegramId) {
          await sendPaymentSuccessNotification(subscription.user.telegramId);
          console.log(`Prodamus payment confirmed for user ${subscription.user.telegramId}`);
        }

        res.json({ success: true, message: 'Payment confirmed' });
      } else if (payment_status === 'failed' || payment_status === 'cancelled') {
        // Платеж не прошел
        console.log(`Prodamus payment ${order_num} failed or cancelled`);

        // Получаем информацию о подписке для отправки уведомления
        const subscription = await paymentService.checkPaymentStatus(order_id);
        if (subscription) {
          const user = await userService.getUserByTelegramId(Number(subscription.userId));
          if (user?.telegramId) {
            await sendPaymentFailedNotification(user.telegramId);
          }
        }

        res.json({ success: true, message: 'Payment status updated' });
      } else {
        // Промежуточный статус (pending, processing и т.д.)
        res.json({ success: true, message: 'Payment status received' });
      }
    } catch (error) {
      console.error('Error processing Prodamus webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // YuKassa Payment Webhook (no auth - called by YuKassa servers)
  app.post('/api/payments/yukassa/webhook', async (req, res) => {
    try {
      const { event, object } = req.body;

      console.log('YuKassa webhook received:', {
        event,
        payment_id: object?.id,
        status: object?.status,
        metadata: object?.metadata,
      });

      // Проверяем подпись запроса от ЮKassa (для безопасности)
      // В production нужно добавить проверку signature из заголовков
      // const signature = req.headers['x-yookassa-signature'];
      // if (!verifyYuKassaSignature(req.body, signature)) {
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }

      if (event === 'payment.succeeded' && object?.status === 'succeeded') {
        // Платеж успешно завершен
        const subscriptionId = object.metadata?.subscription_id;
        const paymentId = object.id;

        if (subscriptionId) {
          const subscription = await paymentService.confirmPayment(subscriptionId, paymentId);

          // Отправляем уведомление пользователю через бота
          if (subscription?.user?.telegramId) {
            await sendPaymentSuccessNotification(subscription.user.telegramId);
            console.log(`YuKassa payment confirmed for user ${subscription.user.telegramId}`);
          }

          res.json({ success: true, message: 'Payment confirmed' });
        } else {
          res.status(400).json({ error: 'Missing subscription_id in metadata' });
        }
      } else if (event === 'payment.canceled' && object?.status === 'canceled') {
        // Платеж отменен
        const subscriptionId = object.metadata?.subscription_id;
        console.log(`YuKassa payment ${object.id} canceled`);

        if (subscriptionId) {
          const subscription = await paymentService.checkPaymentStatus(subscriptionId);
          if (subscription) {
            const user = await userService.getUserByTelegramId(Number(subscription.userId));
            if (user?.telegramId) {
              await sendPaymentFailedNotification(user.telegramId);
            }
          }
        }

        res.json({ success: true, message: 'Payment status updated' });
      } else {
        // Промежуточный статус (pending, waiting_for_capture и т.д.)
        res.json({ success: true, message: 'Payment status received' });
      }
    } catch (error) {
      console.error('Error processing YuKassa webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Endpoint для проверки статуса платежа вручную
  app.get('/api/payments/kaspi/:paymentId/status', authMiddleware, async (req, res) => {
    try {
      const { paymentId } = req.params;

      // Запрашиваем статус у Kaspi API
      const response = await fetch(`https://api.kaspi.kz/pay/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.KASPI_MERCHANT_SECRET}`,
          'X-Merchant-ID': process.env.KASPI_MERCHANT_ID || '',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch payment status' });
      }

      const paymentStatus = await response.json();
      res.json(paymentStatus);
    } catch (error) {
      console.error('Error checking Kaspi payment status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========================================
  // ТЕСТОВЫЕ WEBHOOK ENDPOINTS (для разработки)
  // ========================================

  // Тестовый webhook для симуляции успешной оплаты через ЮKassa
  app.post('/api/test/yukassa/success', authMiddleware, async (req, res) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId is required' });
      }

      // Проверяем, что подписка существует
      const subscription = await paymentService.checkPaymentStatus(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      // Симулируем webhook от ЮKassa
      const testWebhookData = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: `test-${Date.now()}`,
          status: 'succeeded',
          paid: true,
          amount: {
            value: subscription.price.toString(),
            currency: 'RUB',
          },
          metadata: {
            subscription_id: subscriptionId,
            user_id: subscription.userId,
          },
        },
      };

      console.log('🧪 Test YuKassa webhook triggered:', testWebhookData);

      // Подтверждаем платеж
      const confirmedSubscription = await paymentService.confirmPayment(
        subscriptionId,
        testWebhookData.object.id
      );

      // Отправляем уведомление пользователю
      if (confirmedSubscription?.user?.telegramId) {
        await sendPaymentSuccessNotification(confirmedSubscription.user.telegramId);
        console.log(`✅ Test payment confirmed for user ${confirmedSubscription.user.telegramId}`);
      }

      res.json({
        success: true,
        message: 'Test payment confirmed successfully',
        subscription: serializeBigInt(confirmedSubscription),
      });
    } catch (error) {
      console.error('Error processing test YuKassa webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Тестовый webhook для симуляции успешной оплаты через Prodamus
  app.post('/api/test/prodamus/success', authMiddleware, async (req, res) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId is required' });
      }

      // Проверяем, что подписка существует
      const subscription = await paymentService.checkPaymentStatus(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      // Симулируем webhook от Prodamus
      const testWebhookData = {
        order_id: subscriptionId,
        order_num: `TEST-${Date.now()}`,
        payment_status: 'success',
        sum: subscription.price.toString(),
        currency: subscription.currency,
      };

      console.log('🧪 Test Prodamus webhook triggered:', testWebhookData);

      // Подтверждаем платеж
      const confirmedSubscription = await paymentService.confirmPayment(
        subscriptionId,
        testWebhookData.order_num
      );

      // Отправляем уведомление пользователю
      if (confirmedSubscription?.user?.telegramId) {
        await sendPaymentSuccessNotification(confirmedSubscription.user.telegramId);
        console.log(`✅ Test payment confirmed for user ${confirmedSubscription.user.telegramId}`);
      }

      res.json({
        success: true,
        message: 'Test payment confirmed successfully',
        subscription: serializeBigInt(confirmedSubscription),
      });
    } catch (error) {
      console.error('Error processing test Prodamus webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Тестовый webhook для симуляции успешной оплаты через Kaspi
  app.post('/api/test/kaspi/success', authMiddleware, async (req, res) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: 'subscriptionId is required' });
      }

      // Проверяем, что подписка существует
      const subscription = await paymentService.checkPaymentStatus(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      // Симулируем webhook от Kaspi
      const testWebhookData = {
        payment_id: `KSP-TEST-${Date.now()}`,
        status: 'success',
        order_id: subscriptionId,
        amount: subscription.price,
        currency: subscription.currency,
      };

      console.log('🧪 Test Kaspi webhook triggered:', testWebhookData);

      // Подтверждаем платеж
      const confirmedSubscription = await paymentService.confirmPayment(
        subscriptionId,
        testWebhookData.payment_id
      );

      // Отправляем уведомление пользователю
      if (confirmedSubscription?.user?.telegramId) {
        await sendPaymentSuccessNotification(confirmedSubscription.user.telegramId);
        console.log(`✅ Test payment confirmed for user ${confirmedSubscription.user.telegramId}`);
      }

      res.json({
        success: true,
        message: 'Test payment confirmed successfully',
        subscription: serializeBigInt(confirmedSubscription),
      });
    } catch (error) {
      console.error('Error processing test Kaspi webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============================================
  // Bot Settings Endpoints
  // ============================================

  // Получить настройки приветствия
  app.get('/api/settings/welcome', authMiddleware, async (req, res) => {
    try {
      const settings = await botSettingsService.getWelcomeSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error getting welcome settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Обновить настройки приветствия
  app.put('/api/settings/welcome', authMiddleware, async (req, res) => {
    try {
      const { policyText, policyButton, welcomePhoto, welcomeText, welcomeButtonNewbie, welcomeButtonExperienced, newbieCtaText, newbieCtaButton } = req.body;

      const settings = await botSettingsService.updateWelcomeSettings({
        policyText,
        policyButton,
        welcomePhoto,
        welcomeText,
        welcomeButtonNewbie,
        welcomeButtonExperienced,
        newbieCtaText,
        newbieCtaButton,
      });

      res.json(settings);
    } catch (error) {
      console.error('Error updating welcome settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Удалить фото приветствия
  app.delete('/api/settings/welcome/photo', authMiddleware, async (req, res) => {
    try {
      await botSettingsService.removeWelcomePhoto();
      res.json({ success: true, message: 'Welcome photo removed' });
    } catch (error) {
      console.error('Error removing welcome photo:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Загрузка фото для приветствия
  const welcomePhotoUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'welcome');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `welcome-photo${ext}`);
      }
    }),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Только изображения разрешены!'));
      }
    }
  });

  app.post('/api/settings/welcome/photo', authMiddleware, welcomePhotoUpload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Сохраняем путь к файлу в настройках
      const photoUrl = `/uploads/welcome/${req.file.filename}`;
      const settings = await botSettingsService.updateWelcomeSettings({
        welcomePhoto: photoUrl,
      });

      res.json({
        success: true,
        photoUrl,
        settings,
      });
    } catch (error) {
      console.error('Error uploading welcome photo:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ===== PAYMENT SETTINGS API =====

  // Получить настройки оплаты
  app.get('/api/settings/payment', authMiddleware, async (req, res) => {
    try {
      const settings = await botSettingsService.getPaymentSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error getting payment settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Обновить настройки оплаты
  app.put('/api/settings/payment', authMiddleware, async (req, res) => {
    try {
      const { paymentText, paymentPrice, paymentCurrency, paymentDuration, adminTelegramId } = req.body;

      const settings = await botSettingsService.updatePaymentSettings({
        paymentText,
        paymentPrice,
        paymentCurrency,
        paymentDuration,
        adminTelegramId,
      });

      res.json(settings);
    } catch (error) {
      console.error('Error updating payment settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ===== PAYMENT METHODS API =====

  // Получить все методы оплаты
  app.get('/api/payment-methods', authMiddleware, async (req, res) => {
    try {
      const methods = await paymentMethodService.getAllPaymentMethods();
      res.json(methods);
    } catch (error) {
      console.error('Error getting payment methods:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Создать метод оплаты
  app.post('/api/payment-methods', authMiddleware, async (req, res) => {
    try {
      const { name, paymentUrl, buttonText, buttonColor, price, currency, isActive, order } = req.body;

      if (!name || !paymentUrl || !buttonText) {
        return res.status(400).json({ error: 'name, paymentUrl and buttonText are required' });
      }

      const method = await paymentMethodService.createPaymentMethod({
        name,
        paymentUrl,
        buttonText,
        buttonColor,
        price: price ? parseInt(price) : undefined,
        currency,
        isActive,
        order,
      });

      res.json(method);
    } catch (error) {
      console.error('Error creating payment method:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Обновить метод оплаты
  app.put('/api/payment-methods/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, paymentUrl, buttonText, buttonColor, price, currency, isActive, order } = req.body;

      const updateData: any = {
        name,
        paymentUrl,
        buttonText,
        buttonColor,
        isActive,
        order,
      };

      if (price !== undefined && price !== '') {
        updateData.price = parseInt(price);
      } else {
        updateData.price = null;
      }

      if (currency) {
        updateData.currency = currency;
      } else {
        updateData.currency = null;
      }

      const method = await paymentMethodService.updatePaymentMethod(id, updateData);

      res.json(method);
    } catch (error) {
      console.error('Error updating payment method:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Удалить метод оплаты
  app.delete('/api/payment-methods/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      await paymentMethodService.deletePaymentMethod(id);
      res.json({ success: true, message: 'Payment method deleted' });
    } catch (error) {
      console.error('Error deleting payment method:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}

export function startAdminServer() {
  const app = createAdminServer();
  const port = botConfig.adminPort;

  // Слушаем на 0.0.0.0 для доступа из локальной сети
  app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Admin server running on http://0.0.0.0:${port}`);
    console.log(`   Local: http://localhost:${port}`);

    // Показываем локальный IP если возможно
    try {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      const addresses: string[] = [];

      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
          if (iface.family === 'IPv4' && !iface.internal) {
            addresses.push(iface.address);
          }
        }
      }

      if (addresses.length > 0) {
        console.log(`   Network: http://${addresses[0]}:${port}`);
      }
    } catch (e) {
      // Игнорируем ошибки получения IP
    }
  });

  return app;
}
