# Руководство по запуску в Docker

## Требования

Только **Docker Desktop** для Windows:
- Скачать: https://www.docker.com/products/docker-desktop/
- Минимум 4GB RAM
- 10GB свободного места на диске

## Быстрый старт

### 1. Установка Docker Desktop

1. Скачайте Docker Desktop для Windows
2. Установите и запустите
3. Убедитесь, что Docker запущен (иконка в трее)

### 2. Проверка установки

```bash
docker --version
docker-compose --version
```

Должны увидеть версии Docker и Docker Compose.

### 3. Настройка переменных окружения

Файл `.env` уже создан, но проверьте основные параметры:

```env
BOT_TOKEN=2200590363:AAFb3X40nyJiBlC0eZgZL3FamSxo1WO2v5Y
ADMIN_SECRET=your_strong_secret_key
JWT_SECRET=your_jwt_secret_key
```

### 4. Запуск для разработки (режим разработки)

```bash
# Запустить все сервисы
docker-compose -f docker-compose.dev.yml up

# Или в фоновом режиме
docker-compose -f docker-compose.dev.yml up -d
```

Первый запуск займет 3-5 минут (скачивание образов и установка зависимостей).

### 5. Проверка работы

После запуска доступны:
- **Telegram Bot** - работает автоматически
- **Админ панель** - http://localhost:3000/admin/
- **API** - http://localhost:3000/api/
- **Prisma Studio** - http://localhost:5555/

### 6. Просмотр логов

```bash
# Все логи
docker-compose -f docker-compose.dev.yml logs -f

# Только бот
docker-compose -f docker-compose.dev.yml logs -f bot

# Только база данных
docker-compose -f docker-compose.dev.yml logs -f postgres
```

### 7. Остановка

```bash
# Остановить все контейнеры
docker-compose -f docker-compose.dev.yml down

# Остановить и удалить данные БД (ОСТОРОЖНО!)
docker-compose -f docker-compose.dev.yml down -v
```

## Структура Docker сервисов

### Сервисы

1. **postgres** - База данных PostgreSQL
   - Порт: 5432
   - Пользователь: neyroon_user
   - Пароль: neyroon_dev_password (для dev)
   - База: neyroon_bot

2. **bot** - Telegram бот + Админ панель
   - Порт: 3000
   - Автоматический перезапуск при изменении кода (в dev режиме)

3. **prisma-studio** - GUI для управления БД
   - Порт: 5555
   - Доступ: http://localhost:5555

### Volumes (постоянное хранение)

- `postgres_dev_data` - данные PostgreSQL
- `./uploads` - загруженные файлы (рисунки)

## Работа с базой данных

### Применение миграций

Миграции применяются автоматически при запуске, но можно выполнить вручную:

```bash
docker-compose -f docker-compose.dev.yml exec bot npx prisma migrate deploy
```

### Заполнение тестовыми данными

```bash
docker-compose -f docker-compose.dev.yml exec bot npm run prisma:seed
```

### Открыть Prisma Studio

```bash
# Уже запущен на http://localhost:5555
# Или запустить отдельно:
docker-compose -f docker-compose.dev.yml up prisma-studio
```

### Сброс базы данных

```bash
# Удалить все данные и пересоздать
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

## Обновление уроков через API

Контейнеры должны быть запущены. Используйте curl или Postman:

```bash
# Обновить урок 0
curl -X PUT http://localhost:3000/api/lessons/0 \
  -H "Authorization: Bearer your_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "previewVideoUrl": "https://youtube.com/watch?v=preview",
    "fullVideoUrl": "https://youtube.com/watch?v=full",
    "practiceText": "Нарисуйте простые фигуры"
  }'
```

Или через админ панель: http://localhost:3000/admin/

## Режимы запуска

### Режим разработки (рекомендуется)

**Особенности:**
- Hot-reload (изменения кода применяются автоматически)
- Подробные логи
- Prisma Studio включен по умолчанию
- Volumes для кода (изменения сразу видны в контейнере)

**Запуск:**
```bash
docker-compose -f docker-compose.dev.yml up
```

### Режим продакшена

**Особенности:**
- Оптимизированная сборка
- Минимальный размер образов
- Без dev зависимостей
- Автоматический перезапуск при сбоях

**Запуск:**
```bash
docker-compose up -d
```

**Для продакшена на VPS:**
```bash
# Сборка образов
docker-compose build

# Запуск
docker-compose up -d

# Проверка статуса
docker-compose ps

# Логи
docker-compose logs -f
```

## Полезные команды

### Управление контейнерами

```bash
# Список запущенных контейнеров
docker ps

# Список всех контейнеров
docker ps -a

# Перезапустить определенный сервис
docker-compose -f docker-compose.dev.yml restart bot

# Остановить сервис
docker-compose -f docker-compose.dev.yml stop bot

# Запустить сервис
docker-compose -f docker-compose.dev.yml start bot
```

### Выполнение команд в контейнере

```bash
# Войти в контейнер бота
docker-compose -f docker-compose.dev.yml exec bot sh

# Выполнить команду
docker-compose -f docker-compose.dev.yml exec bot npm run prisma:studio

# Просмотреть файлы
docker-compose -f docker-compose.dev.yml exec bot ls -la /app
```

### Работа с базой данных

```bash
# Подключиться к PostgreSQL
docker-compose -f docker-compose.dev.yml exec postgres psql -U neyroon_user -d neyroon_bot

# Бэкап базы данных
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U neyroon_user neyroon_bot > backup.sql

# Восстановление из бэкапа
docker-compose -f docker-compose.dev.yml exec -T postgres psql -U neyroon_user neyroon_bot < backup.sql
```

### Очистка

```bash
# Удалить неиспользуемые образы
docker image prune

# Удалить все неиспользуемые ресурсы
docker system prune

# Полная очистка (ОСТОРОЖНО! Удалит всё)
docker system prune -a --volumes
```

## Решение проблем

### Контейнер не запускается

```bash
# Проверить логи
docker-compose -f docker-compose.dev.yml logs bot

# Проверить статус
docker-compose -f docker-compose.dev.yml ps
```

### База данных не подключается

```bash
# Проверить, что postgres запущен
docker-compose -f docker-compose.dev.yml ps postgres

# Проверить health check
docker inspect neyroon-postgres-dev | grep -A 5 Health
```

### Порт уже занят

Если порт 3000 или 5432 занят другим приложением:

**Вариант 1:** Остановите приложение, использующее порт

**Вариант 2:** Измените порт в `docker-compose.dev.yml`:
```yaml
ports:
  - "3001:3000"  # Вместо 3000
```

### Изменения кода не применяются

```bash
# Пересоздать контейнеры
docker-compose -f docker-compose.dev.yml up --build
```

### "Permission denied" при работе с файлами

На Windows обычно не возникает. На Linux:
```bash
# Изменить владельца папки uploads
sudo chown -R $USER:$USER uploads/
```

### Контейнер постоянно перезапускается

```bash
# Посмотреть последние 100 строк логов
docker-compose -f docker-compose.dev.yml logs --tail=100 bot

# Обычные причины:
# 1. Ошибка в коде
# 2. Неправильный BOT_TOKEN
# 3. Не запущена база данных
```

## Работа с несколькими окружениями

### Development (локальная разработка)
```bash
docker-compose -f docker-compose.dev.yml up
```

### Staging (тестирование перед продакшеном)
```bash
# Создать docker-compose.staging.yml
docker-compose -f docker-compose.staging.yml up
```

### Production (боевой сервер)
```bash
docker-compose up -d
```

## Мониторинг

### Использование ресурсов

```bash
# Статистика контейнеров
docker stats

# Размер образов
docker images

# Использование дискового пространства
docker system df
```

### Health checks

Все сервисы имеют health checks:

```bash
# Проверить здоровье контейнеров
docker-compose -f docker-compose.dev.yml ps
```

## Бэкап и восстановление

### Полный бэкап проекта

```bash
# 1. Бэкап базы данных
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U neyroon_user neyroon_bot > backup_$(date +%Y%m%d).sql

# 2. Бэкап файлов
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# 3. Бэкап .env
cp .env env_backup_$(date +%Y%m%d)
```

### Восстановление

```bash
# 1. Восстановить БД
docker-compose -f docker-compose.dev.yml exec -T postgres psql -U neyroon_user neyroon_bot < backup_20241115.sql

# 2. Восстановить файлы
tar -xzf uploads_backup_20241115.tar.gz

# 3. Восстановить .env
cp env_backup_20241115 .env
```

## Обновление проекта

```bash
# 1. Остановить контейнеры
docker-compose -f docker-compose.dev.yml down

# 2. Обновить код (git pull, изменения и т.д.)

# 3. Пересобрать образы
docker-compose -f docker-compose.dev.yml build

# 4. Запустить
docker-compose -f docker-compose.dev.yml up -d

# 5. Применить миграции (если есть)
docker-compose -f docker-compose.dev.yml exec bot npx prisma migrate deploy
```

## Production Deployment на VPS

### 1. Подготовка VPS

```bash
# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установить Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Загрузка проекта

```bash
git clone your-repo-url
cd neyroon-bot
```

### 3. Настройка .env для продакшена

```bash
nano .env
# Заполнить все продакшен значения
```

### 4. Запуск

```bash
# Сборка и запуск
docker-compose up -d

# Проверка
docker-compose ps
docker-compose logs -f
```

### 5. Автоматический перезапуск

Docker Compose настроен на `restart: unless-stopped`, поэтому контейнеры автоматически запустятся после перезагрузки сервера.

## Советы по производительности

### Оптимизация образов

1. Используйте alpine версии образов (уже используются)
2. Минимизируйте количество слоев
3. Используйте multi-stage builds (уже реализовано)

### Логирование

```bash
# Ограничить размер логов в docker-compose.yml:
services:
  bot:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Networking

Все сервисы находятся в одной Docker сети для быстрой коммуникации.

## Заключение

Docker позволяет:
- ✅ Запустить проект без установки PostgreSQL, Node.js
- ✅ Одинаковое окружение на всех машинах
- ✅ Простое развертывание на VPS
- ✅ Изоляция от других проектов
- ✅ Простые бэкапы и миграции

Для большинства задач используйте режим разработки:
```bash
docker-compose -f docker-compose.dev.yml up
```

Для вопросов и проблем смотрите секцию "Решение проблем" выше.
