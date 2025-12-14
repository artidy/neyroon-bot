import { Bot, InlineKeyboard } from 'grammy';
import { createTimeSelectionKeyboard } from './keyboards';

let botInstance: Bot<any> | null = null;

export function setBotInstance(bot: Bot<any>) {
  botInstance = bot;
}

export function getBotInstance() {
  return botInstance;
}

export async function sendPaymentSuccessNotification(telegramId: bigint) {
  if (!botInstance) {
    console.error('Bot instance not set for notifications');
    return;
  }

  try {
    await botInstance.api.sendMessage(
      telegramId.toString(),
      '✅ **Оплата успешно подтверждена!**\n\n' +
      'Ваша подписка активирована на 30 дней.\n\n' +
      'Теперь выберите удобное время для получения ежедневных уроков:',
      {
        parse_mode: 'Markdown',
        reply_markup: createTimeSelectionKeyboard(),
      }
    );
  } catch (error) {
    console.error('Failed to send payment success notification:', error);
  }
}

export async function sendManualSubscriptionNotification(telegramId: bigint, durationDays: number) {
  if (!botInstance) {
    console.error('Bot instance not set for notifications');
    return;
  }

  try {
    await botInstance.api.sendMessage(
      telegramId.toString(),
      `✅ **Подписка активирована!**\n\n` +
      `Вам была предоставлена подписка на ${durationDays} дней.\n\n` +
      `Используйте /menu для доступа к урокам.`,
      {
        parse_mode: 'Markdown',
      }
    );
  } catch (error) {
    console.error('Failed to send manual subscription notification:', error);
  }
}

export async function sendPaymentFailedNotification(telegramId: bigint) {
  if (!botInstance) {
    console.error('Bot instance not set for notifications');
    return;
  }

  try {
    await botInstance.api.sendMessage(
      telegramId.toString(),
      '❌ **Оплата не прошла**\n\n' +
      'К сожалению, платеж не был подтвержден.\n\n' +
      'Попробуйте оформить подписку снова через /menu',
      {
        parse_mode: 'Markdown',
      }
    );
  } catch (error) {
    console.error('Failed to send payment failed notification:', error);
  }
}
