import { InlineKeyboard } from 'grammy';

export const createNewbieKeyboard = () => {
  return new InlineKeyboard()
    .text('Я новичок', 'newbie_yes')
    .text('Уже рисую', 'newbie_no');
};

export const createPaymentKeyboard = (paymentUrl: string) => {
  return new InlineKeyboard()
    .url('Оплатить подписку', paymentUrl)
    .row()
    .text('Я оплатил', 'payment_check')
    .text('Отказаться', 'payment_decline');
};

export const createTimeSelectionKeyboard = () => {
  const keyboard = new InlineKeyboard();
  const times = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

  times.forEach((time, index) => {
    keyboard.text(time, `time_${time}`);
    if ((index + 1) % 2 === 0) keyboard.row();
  });

  keyboard.row().text('◀️ Назад', 'main_menu');

  return keyboard;
};

export const createMainMenuKeyboard = () => {
  return new InlineKeyboard()
    .text('📚 Мои уроки', 'my_lessons')
    .row()
    .text('⏰ Изменить время', 'change_time')
    .text('ℹ️ О курсе', 'about_course')
    .row()
    .text('💳 Подписка', 'subscription_info');
};

export const createLessonKeyboard = (lessonNumber: number, hasAccess: boolean) => {
  const keyboard = new InlineKeyboard();

  if (hasAccess) {
    keyboard.text('📹 Смотреть урок', `watch_lesson_${lessonNumber}`)
      .row()
      .text('📤 Отправить рисунок', `send_drawing_${lessonNumber}`)
      .row()
      .text('◀️ Назад', 'main_menu');
  } else {
    keyboard.text('🔒 Нужна подписка', 'show_payment')
      .row()
      .text('◀️ Назад', 'main_menu');
  }

  return keyboard;
};

export const createAdminKeyboard = () => {
  return new InlineKeyboard()
    .text('👥 Пользователи', 'admin_users')
    .text('📊 Статистика', 'admin_stats')
    .row()
    .text('📚 Уроки', 'admin_lessons')
    .text('🎨 Рисунки', 'admin_drawings')
    .row()
    .text('💰 Платежи', 'admin_payments');
};
