import prisma from '../database/prisma';

const SETTINGS_KEY = 'main';

interface WelcomeSettings {
  policyText?: string | null;
  policyButton: string;
  welcomePhoto?: string | null;
  welcomeText?: string | null;
  welcomeButtonNewbie: string;
  welcomeButtonExperienced: string;
  newbieCtaText: string;
  newbieCtaButton: string;
}

interface PaymentSettings {
  paymentText?: string | null;
  paymentPrice?: number | null;
  paymentCurrency: string;
  paymentDuration: number;
  adminTelegramId?: string | null;
}

class BotSettingsService {
  /**
   * Получить настройки приветствия
   */
  async getWelcomeSettings(): Promise<WelcomeSettings> {
    const settings = await prisma.botSettings.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (!settings) {
      // Создаем настройки по умолчанию
      return await this.createDefaultSettings();
    }

    return {
      policyText: settings.policyText,
      policyButton: settings.policyButton,
      welcomePhoto: settings.welcomePhoto,
      welcomeText: settings.welcomeText,
      welcomeButtonNewbie: settings.welcomeButtonNewbie,
      welcomeButtonExperienced: settings.welcomeButtonExperienced,
      newbieCtaText: settings.newbieCtaText,
      newbieCtaButton: settings.newbieCtaButton,
    };
  }

  /**
   * Обновить настройки приветствия
   */
  async updateWelcomeSettings(data: Partial<WelcomeSettings>): Promise<WelcomeSettings> {
    // Формируем объект обновления только с переданными полями
    const updateData: any = {};

    if (data.policyText !== undefined) {
      updateData.policyText = data.policyText;
    }

    if (data.policyButton !== undefined) {
      updateData.policyButton = data.policyButton;
    }

    if (data.welcomePhoto !== undefined) {
      updateData.welcomePhoto = data.welcomePhoto;
    }

    if (data.welcomeText !== undefined) {
      updateData.welcomeText = data.welcomeText;
    }

    if (data.welcomeButtonNewbie !== undefined) {
      updateData.welcomeButtonNewbie = data.welcomeButtonNewbie;
    }

    if (data.welcomeButtonExperienced !== undefined) {
      updateData.welcomeButtonExperienced = data.welcomeButtonExperienced;
    }

    if (data.newbieCtaText !== undefined) {
      updateData.newbieCtaText = data.newbieCtaText;
    }

    if (data.newbieCtaButton !== undefined) {
      updateData.newbieCtaButton = data.newbieCtaButton;
    }

    const settings = await prisma.botSettings.upsert({
      where: { key: SETTINGS_KEY },
      update: updateData,
      create: {
        key: SETTINGS_KEY,
        policyText: data.policyText || null,
        policyButton: data.policyButton || 'Я согласен',
        welcomePhoto: data.welcomePhoto || null,
        welcomeText: data.welcomeText || null,
        welcomeButtonNewbie: data.welcomeButtonNewbie || 'Новичок',
        welcomeButtonExperienced: data.welcomeButtonExperienced || 'Уже знаком',
        newbieCtaText: data.newbieCtaText || '👆 Посмотрели бесплатные уроки?\n\nГотовы присоединиться к полному курсу?',
        newbieCtaButton: data.newbieCtaButton || '🚀 Хочу в проект',
      },
    });

    return {
      policyText: settings.policyText,
      policyButton: settings.policyButton,
      welcomePhoto: settings.welcomePhoto,
      welcomeText: settings.welcomeText,
      welcomeButtonNewbie: settings.welcomeButtonNewbie,
      welcomeButtonExperienced: settings.welcomeButtonExperienced,
      newbieCtaText: settings.newbieCtaText,
      newbieCtaButton: settings.newbieCtaButton,
    };
  }

  /**
   * Создать настройки по умолчанию
   */
  private async createDefaultSettings(): Promise<WelcomeSettings> {
    const defaultText = `🎨 **Добро пожаловать в Neyroon Bot!**

Это интерактивный курс рисования, который поможет вам освоить искусство создания нейронных изображений.

📚 **Что вас ждет:**
• Ежедневные видео-уроки
• Практические задания
• Обратная связь от преподавателя
• Доступ к эксклюзивным материалам

Выберите ваш уровень опыта:`;

    const settings = await prisma.botSettings.create({
      data: {
        key: SETTINGS_KEY,
        policyText: null,
        policyButton: 'Я согласен',
        welcomeText: defaultText,
        welcomeButtonNewbie: 'Новичок',
        welcomeButtonExperienced: 'Уже знаком',
        newbieCtaText: '👆 Посмотрели бесплатные уроки?\n\nГотовы присоединиться к полному курсу?',
        newbieCtaButton: '🚀 Хочу в проект',
      },
    });

    return {
      policyText: settings.policyText,
      policyButton: settings.policyButton,
      welcomePhoto: settings.welcomePhoto,
      welcomeText: settings.welcomeText,
      welcomeButtonNewbie: settings.welcomeButtonNewbie,
      welcomeButtonExperienced: settings.welcomeButtonExperienced,
      newbieCtaText: settings.newbieCtaText,
      newbieCtaButton: settings.newbieCtaButton,
    };
  }

  /**
   * Удалить фото приветствия
   */
  async removeWelcomePhoto(): Promise<void> {
    await prisma.botSettings.updateMany({
      where: { key: SETTINGS_KEY },
      data: { welcomePhoto: null },
    });
  }

  /**
   * Получить настройки оплаты
   */
  async getPaymentSettings(): Promise<PaymentSettings> {
    const settings = await prisma.botSettings.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (!settings) {
      return {
        paymentText: null,
        paymentPrice: null,
        paymentCurrency: 'KZT',
        paymentDuration: 30,
        adminTelegramId: null,
      };
    }

    return {
      paymentText: settings.paymentText,
      paymentPrice: settings.paymentPrice,
      paymentCurrency: settings.paymentCurrency,
      paymentDuration: settings.paymentDuration,
      adminTelegramId: settings.adminTelegramId,
    };
  }

  /**
   * Обновить настройки оплаты
   */
  async updatePaymentSettings(data: Partial<PaymentSettings>): Promise<PaymentSettings> {
    const updateData: any = {};

    if (data.paymentText !== undefined) {
      updateData.paymentText = data.paymentText;
    }

    if (data.paymentPrice !== undefined) {
      updateData.paymentPrice = data.paymentPrice;
    }

    if (data.paymentCurrency !== undefined) {
      updateData.paymentCurrency = data.paymentCurrency;
    }

    if (data.paymentDuration !== undefined) {
      updateData.paymentDuration = data.paymentDuration;
    }

    if (data.adminTelegramId !== undefined) {
      updateData.adminTelegramId = data.adminTelegramId;
    }

    const settings = await prisma.botSettings.upsert({
      where: { key: SETTINGS_KEY },
      update: updateData,
      create: {
        key: SETTINGS_KEY,
        policyButton: 'Я согласен',
        welcomeButtonNewbie: 'Новичок',
        welcomeButtonExperienced: 'Уже знаком',
        newbieCtaText: '👆 Посмотрели бесплатные уроки?\n\nГотовы присоединиться к полному курсу?',
        newbieCtaButton: '🚀 Хочу в проект',
        paymentText: data.paymentText || null,
        paymentPrice: data.paymentPrice || null,
        paymentCurrency: data.paymentCurrency || 'KZT',
        paymentDuration: data.paymentDuration || 30,
        adminTelegramId: data.adminTelegramId || null,
      },
    });

    return {
      paymentText: settings.paymentText,
      paymentPrice: settings.paymentPrice,
      paymentCurrency: settings.paymentCurrency,
      paymentDuration: settings.paymentDuration,
      adminTelegramId: settings.adminTelegramId,
    };
  }
}

export default new BotSettingsService();
