import prisma from '../database/prisma';
import { paymentConfig } from '../utils/config';
import { UserStatus } from '@prisma/client';

export class PaymentService {
  async createSubscription(userId: string, provider: 'kaspi' | 'yukassa' | 'prodamus') {
    return await prisma.subscription.create({
      data: {
        userId,
        price: paymentConfig.price,
        currency: paymentConfig.currency,
        paymentProvider: provider,
        status: 'pending',
      },
    });
  }

  async confirmPayment(subscriptionId: string, paymentId: string) {
    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'completed',
        paymentId,
        startDate: new Date(),
        endDate: new Date(Date.now() + paymentConfig.durationDays * 24 * 60 * 60 * 1000),
      },
      include: {
        user: true,
      },
    });

    // Обновляем статус пользователя
    await prisma.user.update({
      where: { id: subscription.userId },
      data: {
        status: UserStatus.ACTIVE,
      },
    });

    return subscription;
  }

  async checkPaymentStatus(subscriptionId: string) {
    return await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
  }

  async createKaspiPaymentLink(subscriptionId: string): Promise<string> {
    // Kaspi.kz Payment API интеграция
    const amount = paymentConfig.price;
    const merchantId = paymentConfig.kaspi.merchantId;
    const merchantSecret = paymentConfig.kaspi.merchantSecret;

    // Получаем информацию о подписке
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Формируем данные для платежа Kaspi
    const paymentData = {
      merchant_id: merchantId,
      amount: amount.toString(),
      currency: paymentConfig.currency,
      order_id: subscriptionId,
      description: `Подписка на курс рисования (30 дней)`,
      // URL для возврата пользователя после оплаты
      success_url: `https://t.me/${process.env.BOT_USERNAME}`,
      failure_url: `https://t.me/${process.env.BOT_USERNAME}`,
      // Webhook URL для уведомления о статусе платежа
      callback_url: `${process.env.WEBHOOK_URL}/api/payments/kaspi/webhook`,
      // Метаданные для идентификации
      metadata: {
        user_id: subscription.userId,
        subscription_id: subscriptionId,
      },
    };

    try {
      // Отправляем запрос к Kaspi API для создания платежа
      const response = await fetch('https://api.kaspi.kz/pay/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${merchantSecret}`,
          'X-Merchant-ID': merchantId,
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new Error(`Kaspi API error: ${response.statusText}`);
      }

      const result: any = await response.json();

      // Сохраняем payment_id от Kaspi для дальнейшей проверки статуса
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          paymentId: result.payment_id || `KASPI-${Date.now()}`,
        },
      });

      // Возвращаем ссылку на оплату
      return result.payment_url || result.redirect_url || `https://kaspi.kz/pay?merchant=${merchantId}&amount=${amount}&order=${subscriptionId}`;
    } catch (error) {
      console.error('Kaspi payment creation error:', error);
      // В случае ошибки API возвращаем fallback ссылку
      return `https://kaspi.kz/pay?merchant=${merchantId}&amount=${amount}&order=${subscriptionId}`;
    }
  }

  async createProdamusPaymentLink(subscriptionId: string): Promise<string> {
    // Prodamus Payment API интеграция
    const amount = paymentConfig.price;
    const apiKey = paymentConfig.prodamus.apiKey;
    const projectId = paymentConfig.prodamus.projectId;

    // Получаем информацию о подписке
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Формируем данные для платежа Prodamus
    const paymentData = {
      order_id: subscriptionId,
      customer_phone: subscription.user.telegramId.toString(),
      customer_extra: subscription.user.username || subscription.user.firstName || '',
      products: [
        {
          name: 'Подписка на курс рисования',
          price: amount,
          quantity: 1,
          sum: amount,
        },
      ],
      do: 'link',
      urlSuccess: `https://t.me/${process.env.BOT_USERNAME}`,
      urlNotification: `${process.env.WEBHOOK_URL}/api/payments/prodamus/webhook`,
      paymentMethod: 'bank_card',
    };

    try {
      // Отправляем запрос к Prodamus API для создания платежа
      const response = await fetch(`https://${projectId}.pay.prodamus.ru/api/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new Error(`Prodamus API error: ${response.statusText}`);
      }

      const result: any = await response.json();

      // Сохраняем payment_id от Prodamus
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          paymentId: result.id || `PRODAMUS-${Date.now()}`,
        },
      });

      // Возвращаем ссылку на оплату
      return result.payment_link || result.link || `https://${projectId}.pay.prodamus.ru/`;
    } catch (error) {
      console.error('Prodamus payment creation error:', error);
      // В случае ошибки API возвращаем fallback ссылку
      return `https://${projectId}.pay.prodamus.ru/`;
    }
  }

  async createYuKassaPaymentLink(subscriptionId: string): Promise<string> {
    // ЮKassa Payment API интеграция
    const amount = paymentConfig.price;
    const shopId = paymentConfig.yukassa.shopId;
    const secretKey = paymentConfig.yukassa.secretKey;

    // Получаем информацию о подписке
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Формируем данные для платежа ЮKassa
    const paymentData = {
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: `https://t.me/${process.env.BOT_USERNAME}`,
      },
      capture: true,
      description: `Подписка на курс рисования (30 дней)`,
      metadata: {
        subscription_id: subscriptionId,
        user_id: subscription.userId,
        telegram_id: subscription.user.telegramId.toString(),
      },
    };

    try {
      // Создаем Basic Auth заголовок
      const authHeader = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

      // Отправляем запрос к ЮKassa API для создания платежа
      const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': subscriptionId,
          'Authorization': `Basic ${authHeader}`,
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YuKassa API error: ${response.statusText} - ${errorText}`);
      }

      const result: any = await response.json();

      // Сохраняем payment_id от ЮKassa
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          paymentId: result.id || `YUKASSA-${Date.now()}`,
        },
      });

      // Возвращаем ссылку на оплату
      return result.confirmation?.confirmation_url || `https://yookassa.ru/my/payments/${result.id}`;
    } catch (error) {
      console.error('YuKassa payment creation error:', error);
      // В случае ошибки API возвращаем fallback ссылку
      return `https://yookassa.ru/`;
    }
  }

  async getActiveSubscriptions() {
    return await prisma.subscription.findMany({
      where: {
        status: 'completed',
        endDate: {
          gte: new Date(),
        },
        deletedAt: null,
      },
      include: {
        user: true,
      },
    });
  }

  async getExpiredSubscriptions() {
    const expiredSubs = await prisma.subscription.findMany({
      where: {
        status: 'completed',
        endDate: {
          lt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    // Обновляем статус пользователей с истекшей подпиской
    for (const sub of expiredSubs) {
      await prisma.user.update({
        where: { id: sub.userId },
        data: {
          status: UserStatus.EXPIRED,
        },
      });
    }

    return expiredSubs;
  }

  async getPaymentStats() {
    const total = await prisma.subscription.count({
      where: { status: 'completed' },
    });

    const totalRevenue = await prisma.subscription.aggregate({
      where: { status: 'completed' },
      _sum: {
        price: true,
      },
    });

    const activeCount = await prisma.subscription.count({
      where: {
        status: 'completed',
        endDate: {
          gte: new Date(),
        },
      },
    });

    const monthlyRevenue = await prisma.subscription.aggregate({
      where: {
        status: 'completed',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      _sum: {
        price: true,
      },
    });

    return {
      totalSubscriptions: total,
      totalRevenue: totalRevenue._sum.price || 0,
      activeSubscriptions: activeCount,
      monthlyRevenue: monthlyRevenue._sum.price || 0,
    };
  }

  // Создание подписки вручную (для админ-панели)
  async createManualSubscription(userId: string, durationDays: number) {
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        price: 0, // Бесплатная подписка
        currency: paymentConfig.currency,
        paymentProvider: 'manual',
        status: 'completed',
        paymentId: `MANUAL-${Date.now()}`,
        startDate: new Date(),
        endDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      },
      include: {
        user: true,
      },
    });

    // Обновляем статус пользователя
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
      },
    });

    return subscription;
  }

  // Удалить подписку (мягкое удаление)
  async deleteSubscription(subscriptionId: string) {
    return await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

export default new PaymentService();
