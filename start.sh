#!/bin/bash

# Скрипт для быстрого запуска на Linux/Mac

echo "================================================"
echo "  Neyroon Bot - Запуск в Docker"
echo "================================================"
echo ""

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "[ОШИБКА] Docker не найден!"
    echo "Установите Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "[OK] Docker найден"
echo ""

# Проверка .env
if [ ! -f .env ]; then
    echo "[ВНИМАНИЕ] Файл .env не найден!"
    echo "Создайте файл .env на основе .env.example"
    exit 1
fi

echo "[OK] Файл .env найден"
echo ""

echo "Выберите режим запуска:"
echo ""
echo "1 - Разработка (с hot-reload)"
echo "2 - Продакшн"
echo "3 - Только Prisma Studio"
echo "4 - Остановить все контейнеры"
echo "5 - Показать логи"
echo ""

read -p "Ваш выбор (1-5): " choice

case $choice in
    1)
        echo ""
        echo "[Запуск в режиме разработки...]"
        echo ""
        docker-compose -f docker-compose.dev.yml up
        ;;
    2)
        echo ""
        echo "[Запуск в режиме продакшн...]"
        echo ""
        docker-compose up -d
        echo ""
        echo "[OK] Бот запущен в фоновом режиме"
        echo "Админ панель: http://localhost:3000/admin/"
        echo "Логи: docker-compose logs -f"
        ;;
    3)
        echo ""
        echo "[Запуск Prisma Studio...]"
        echo ""
        docker-compose -f docker-compose.dev.yml up prisma-studio
        ;;
    4)
        echo ""
        echo "[Остановка всех контейнеров...]"
        docker-compose -f docker-compose.dev.yml down
        docker-compose down
        echo "[OK] Все контейнеры остановлены"
        ;;
    5)
        echo ""
        echo "[Просмотр логов (Ctrl+C для выхода)...]"
        echo ""
        docker-compose -f docker-compose.dev.yml logs -f
        ;;
    *)
        echo ""
        echo "[ОШИБКА] Неверный выбор"
        exit 1
        ;;
esac
