import dotenv from 'dotenv';
dotenv.config();

import { createBot } from './bot';
import lessonService from './services/lessonService';
import schedulerService from './services/schedulerService';
import drawingService from './services/drawingService';
import paymentMethodService from './services/paymentMethodService';
import prisma from './database/prisma';
import { startAdminServer } from './admin/server';

async function main() {
  try {
    console.log('🚀 Starting Neyroon Bot...');

    // Проверяем подключение к БД
    await prisma.$connect();
    console.log('✅ Database connected');

    // Инициализируем уроки (если их нет)
    await lessonService.initializeLessons();
    console.log('✅ Lessons initialized');

    // Инициализируем методы оплаты (если их нет)
    await paymentMethodService.initializePaymentMethods();
    console.log('✅ Payment methods initialized');

    // Создаем директории для загрузок
    await drawingService.ensureUploadDirectory();
    console.log('✅ Upload directories created');

    // Запускаем админ панель
    startAdminServer();
    console.log('✅ Admin server started');

    // Создаем и запускаем бота
    const bot = createBot();
    console.log('✅ Bot created');

    // Инициализируем планировщики
    await schedulerService.initializeSchedulers(bot);
    console.log('✅ Schedulers initialized');

    // Запускаем бота
    await bot.start();
    console.log('✅ Bot started successfully!');
    console.log('Bot is running...');
  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏳ Shutting down...');
  schedulerService.stopAll();
  await prisma.$disconnect();
  console.log('✅ Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏳ Shutting down...');
  schedulerService.stopAll();
  await prisma.$disconnect();
  console.log('✅ Shutdown complete');
  process.exit(0);
});

main();
