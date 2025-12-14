import prisma from '../database/prisma';

interface PaymentMethodData {
  name: string;
  paymentUrl: string;
  buttonText: string;
  buttonColor?: string;
  price?: number;
  currency?: string;
  isActive?: boolean;
  order?: number;
}

class PaymentMethodService {
  /**
   * Получить все методы оплаты
   */
  async getAllPaymentMethods() {
    return await prisma.paymentMethod.findMany({
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Получить активные методы оплаты
   */
  async getActivePaymentMethods() {
    return await prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Получить метод оплаты по ID
   */
  async getPaymentMethod(id: string) {
    return await prisma.paymentMethod.findUnique({
      where: { id },
    });
  }

  /**
   * Создать метод оплаты
   */
  async createPaymentMethod(data: PaymentMethodData) {
    return await prisma.paymentMethod.create({
      data: {
        name: data.name,
        paymentUrl: data.paymentUrl,
        buttonText: data.buttonText,
        buttonColor: data.buttonColor ?? 'primary',
        price: data.price,
        currency: data.currency,
        isActive: data.isActive ?? true,
        order: data.order ?? 0,
      },
    });
  }

  /**
   * Обновить метод оплаты
   */
  async updatePaymentMethod(id: string, data: Partial<PaymentMethodData>) {
    return await prisma.paymentMethod.update({
      where: { id },
      data,
    });
  }

  /**
   * Удалить метод оплаты
   */
  async deletePaymentMethod(id: string) {
    return await prisma.paymentMethod.delete({
      where: { id },
    });
  }

  /**
   * Инициализировать методы оплаты по умолчанию
   * (оставляем пустым - пользователь сам добавит через админ панель)
   */
  async initializePaymentMethods() {
    // Ничего не делаем - пользователь добавит способы оплаты сам
    console.log('Payment methods ready (no defaults)');
  }
}

export default new PaymentMethodService();
