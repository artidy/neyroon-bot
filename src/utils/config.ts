import dotenv from 'dotenv';
import { BotConfig, DatabaseConfig, PaymentConfig } from '../types';

dotenv.config();

export const botConfig: BotConfig = {
  token: process.env.BOT_TOKEN || '',
  adminPort: parseInt(process.env.ADMIN_PORT || '3000'),
};

export const databaseConfig: DatabaseConfig = {
  url: process.env.DATABASE_URL || '',
};

export const paymentConfig: PaymentConfig = {
  yukassa: {
    shopId: process.env.YUKASSA_SHOP_ID || '',
    secretKey: process.env.YUKASSA_SECRET_KEY || '',
  },
  kaspi: {
    merchantId: process.env.KASPI_MERCHANT_ID || '',
    merchantSecret: process.env.KASPI_MERCHANT_SECRET || '',
  },
  prodamus: {
    apiKey: process.env.PRODAMUS_API_KEY || '',
    secretKey: process.env.PRODAMUS_SECRET_KEY || '',
    projectId: process.env.PRODAMUS_PROJECT_ID || '',
  },
  price: parseInt(process.env.SUBSCRIPTION_PRICE || '4000'),
  currency: process.env.SUBSCRIPTION_CURRENCY || 'KZT',
  durationDays: parseInt(process.env.SUBSCRIPTION_DURATION_DAYS || '30'),
};

export const uploadConfig = {
  path: process.env.UPLOAD_PATH || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
};

export const schedulerConfig = {
  timezone: process.env.TIMEZONE || 'Asia/Almaty',
  defaultLessonTime: process.env.DEFAULT_LESSON_TIME || '10:00',
};
