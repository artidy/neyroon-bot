import { PrismaClient, LessonType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Создаем уроки
  const lessons = [
    {
      lessonNumber: 0,
      type: LessonType.INTRO,
      title: 'Вводный урок',
      description: 'Знакомство с курсом и основными принципами рисования',
      previewVideoUrl: 'https://www.youtube.com/watch?v=example',
      fullVideoUrl: 'https://www.youtube.com/watch?v=example',
      practiceText: 'Подготовьте материалы для рисования: бумагу, карандаши, ластик',
      order: 0,
    },
    {
      lessonNumber: 1,
      type: LessonType.FREE,
      title: 'Бесплатный урок - Основы',
      description: 'Базовые техники и первая практика',
      previewVideoUrl: 'https://www.youtube.com/watch?v=example',
      fullVideoUrl: 'https://www.youtube.com/watch?v=example',
      practiceText: 'Нарисуйте простые геометрические фигуры: круг, квадрат, треугольник',
      order: 1,
    },
    {
      lessonNumber: 2,
      type: LessonType.PREMIUM,
      title: 'Урок 2 - Линии и формы',
      description: 'Учимся рисовать основные формы',
      practiceText: 'Практика: нарисуйте 10 различных объектов используя только базовые формы',
      order: 2,
    },
    {
      lessonNumber: 3,
      type: LessonType.PREMIUM,
      title: 'Урок 3 - Перспектива',
      description: 'Основы перспективы в рисунке',
      practiceText: 'Нарисуйте комнату в одноточечной перспективе',
      order: 3,
    },
    {
      lessonNumber: 4,
      type: LessonType.PREMIUM,
      title: 'Урок 4 - Свет и тень',
      description: 'Работа с светотенью',
      practiceText: 'Нарисуйте 5 простых объектов с разным освещением',
      order: 4,
    },
    {
      lessonNumber: 5,
      type: LessonType.PREMIUM,
      title: 'Урок 5 - Композиция',
      description: 'Построение композиции',
      practiceText: 'Создайте 3 различные композиции одного и того же объекта',
      order: 5,
    },
    {
      lessonNumber: 6,
      type: LessonType.PREMIUM,
      title: 'Урок 6 - Текстуры',
      description: 'Создание различных текстур',
      practiceText: 'Нарисуйте 10 различных текстур (дерево, металл, ткань и т.д.)',
      order: 6,
    },
    {
      lessonNumber: 7,
      type: LessonType.PREMIUM,
      title: 'Урок 7 - Цвет',
      description: 'Основы работы с цветом',
      practiceText: 'Создайте цветовую палитру и нарисуйте простой пейзаж',
      order: 7,
    },
    {
      lessonNumber: 8,
      type: LessonType.PREMIUM,
      title: 'Урок 8 - Детализация',
      description: 'Проработка деталей',
      practiceText: 'Выберите объект и детально его проработайте',
      order: 8,
    },
    {
      lessonNumber: 9,
      type: LessonType.FINAL,
      title: 'Финальный проект',
      description: 'Применяем все полученные знания',
      practiceText: 'Создайте финальную работу, используя все изученные техники. Отправьте все свои работы за курс.',
      order: 9,
    },
  ];

  for (const lesson of lessons) {
    await prisma.lesson.upsert({
      where: { lessonNumber: lesson.lessonNumber },
      update: lesson,
      create: lesson,
    });
  }

  console.log('✅ Lessons created');

  // Создаем тестового админа
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@neyroon.com',
      passwordHash,
    },
  });

  console.log('✅ Admin user created (username: admin, password: admin123)');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
