import prisma from '../database/prisma';

interface CreatePaymentRequestData {
  userId: string;
  paymentMethodId: string;
  price: number;
  currency: string;
  paymentMethodName: string;
  paymentUrl: string;
}

class PaymentRequestService {
  /**
   * Создать заявку на оплату
   */
  async createPaymentRequest(data: CreatePaymentRequestData) {
    return await prisma.paymentRequest.create({
      data: {
        userId: data.userId,
        paymentMethodId: data.paymentMethodId,
        price: data.price,
        currency: data.currency,
        paymentMethodName: data.paymentMethodName,
        paymentUrl: data.paymentUrl,
        status: 'pending',
        adminNotified: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Получить заявку по ID
   */
  async getPaymentRequest(id: string) {
    return await prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
  }

  /**
   * Получить все заявки пользователя (кроме удаленных)
   */
  async getUserPaymentRequests(userId: string) {
    return await prisma.paymentRequest.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Получить активные (ожидающие) заявки пользователя (кроме удаленных)
   */
  async getUserPendingRequests(userId: string) {
    return await prisma.paymentRequest.findMany({
      where: {
        userId,
        status: 'pending',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Получить все ожидающие заявки (кроме удаленных)
   */
  async getAllPendingRequests() {
    return await prisma.paymentRequest.findMany({
      where: {
        status: 'pending',
        deletedAt: null,
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Получить все заявки (кроме удаленных)
   */
  async getAllPaymentRequests() {
    return await prisma.paymentRequest.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Отметить заявку как уведомленную
   */
  async markAsNotified(id: string) {
    return await prisma.paymentRequest.update({
      where: { id },
      data: {
        adminNotified: true,
        notifiedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Подтвердить заявку
   */
  async confirmPaymentRequest(id: string, confirmedBy: string) {
    return await prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedBy,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Отклонить заявку
   */
  async rejectPaymentRequest(id: string, confirmedBy: string) {
    return await prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        confirmedBy,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Отменить заявку (пользователем)
   */
  async cancelPaymentRequest(id: string) {
    return await prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'cancelled',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Удалить заявку на оплату (мягкое удаление)
   */
  async deletePaymentRequest(id: string) {
    return await prisma.paymentRequest.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

export default new PaymentRequestService();
