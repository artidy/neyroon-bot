#!/bin/bash

# Скрипт для развертывания Neyroon Bot на production сервере

set -e

echo "🚀 Начинаем развертывание Neyroon Bot..."

# Проверка root прав
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  Пожалуйста, запустите скрипт с sudo"
  exit 1
fi

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода с цветом
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Проверка установки Docker
echo "📦 Проверка Docker..."
if ! command -v docker &> /dev/null; then
    print_warning "Docker не установлен. Устанавливаем..."

    # Обновление пакетов
    apt update && apt upgrade -y

    # Установка зависимостей
    apt install -y apt-transport-https ca-certificates curl software-properties-common

    # Добавление Docker GPG ключа
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Добавление Docker репозитория
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Установка Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io

    print_success "Docker установлен"
else
    print_success "Docker уже установлен"
fi

# 2. Проверка установки Docker Compose
echo "📦 Проверка Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    print_warning "Docker Compose не установлен. Устанавливаем..."

    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    print_success "Docker Compose установлен"
else
    print_success "Docker Compose уже установлен"
fi

# 3. Создание директории проекта
PROJECT_DIR="/opt/neyroon-bot"
echo "📁 Создание директории проекта..."

if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
    print_success "Директория создана: $PROJECT_DIR"
else
    print_warning "Директория уже существует: $PROJECT_DIR"
fi

# 4. Копирование файлов (если скрипт запущен из папки проекта)
CURRENT_DIR=$(pwd)
if [ "$CURRENT_DIR" != "$PROJECT_DIR" ]; then
    echo "📋 Копирование файлов проекта..."

    # Копируем все файлы кроме node_modules, .git и uploads
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'uploads' --progress . "$PROJECT_DIR/"

    print_success "Файлы скопированы"
fi

# Переходим в директорию проекта
cd "$PROJECT_DIR"

# 5. Проверка .env файла
echo "🔧 Проверка конфигурации..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_warning "Файл .env не найден. Создаем из .env.example..."
        cp .env.example .env

        echo ""
        print_warning "ВАЖНО! Отредактируйте файл .env и заполните все необходимые переменные:"
        echo "  - BOT_TOKEN"
        echo "  - POSTGRES_PASSWORD"
        echo "  - ADMIN_SECRET"
        echo "  - JWT_SECRET"
        echo "  - Payment credentials (KASPI, PRODAMUS)"
        echo ""
        read -p "Нажмите Enter после редактирования .env файла..."
    else
        print_error "Файл .env.example не найден!"
        exit 1
    fi
else
    print_success "Файл .env найден"
fi

# 6. Создание директории для uploads
echo "📁 Создание директории uploads..."
mkdir -p uploads/drawings uploads/videos
chmod -R 755 uploads
print_success "Директория uploads создана"

# 7. Остановка существующих контейнеров
echo "🛑 Остановка существующих контейнеров..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
print_success "Контейнеры остановлены"

# 8. Сборка и запуск
echo "🏗️  Сборка и запуск контейнеров..."
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# 9. Ожидание запуска
echo "⏳ Ожидание запуска сервисов..."
sleep 10

# 10. Проверка статуса
echo "🔍 Проверка статуса контейнеров..."
docker-compose -f docker-compose.prod.yml ps

# 11. Проверка логов
echo ""
echo "📋 Последние логи:"
docker-compose -f docker-compose.prod.yml logs --tail 20 bot

# 12. Проверка health endpoint
echo ""
echo "🏥 Проверка health endpoint..."
sleep 5
if curl -s http://localhost:3000/health | grep -q "ok"; then
    print_success "Приложение работает!"
else
    print_error "Приложение не отвечает на health check"
fi

# 13. Вывод информации
echo ""
echo "============================================"
print_success "Развертывание завершено!"
echo "============================================"
echo ""
echo "📊 Полезные команды:"
echo "  Просмотр логов:      docker-compose -f docker-compose.prod.yml logs -f"
echo "  Перезапуск:          docker-compose -f docker-compose.prod.yml restart"
echo "  Остановка:           docker-compose -f docker-compose.prod.yml down"
echo "  Статус:              docker-compose -f docker-compose.prod.yml ps"
echo ""
echo "🌐 Доступ:"
echo "  Админ панель:        http://$(hostname -I | awk '{print $1}'):3000/admin/"
echo "  API:                 http://$(hostname -I | awk '{print $1}'):3000/api/"
echo "  Health check:        http://$(hostname -I | awk '{print $1}'):3000/health"
echo ""
echo "📝 Следующие шаги:"
echo "  1. Настройте домен (если есть)"
echo "  2. Установите SSL сертификат (certbot)"
echo "  3. Настройте webhook URL в платежных системах"
echo "  4. Добавьте видео уроки через админ панель"
echo ""
print_warning "Не забудьте настроить firewall!"
echo "  sudo ufw allow 22/tcp"
echo "  sudo ufw allow 80/tcp"
echo "  sudo ufw allow 443/tcp"
echo "  sudo ufw enable"
echo ""
