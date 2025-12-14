# Быстрое развертывание на VPS

## Вариант 1: Автоматическое развертывание (рекомендуется)

### 1. Подключитесь к серверу

```bash
ssh root@your-server-ip
```

### 2. Загрузите проект на сервер

**Через SCP (с вашего компьютера):**
```bash
# Создаем архив проекта (исключая лишние файлы)
tar -czf neyroon-bot.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=uploads \
  --exclude=dist \
  .

# Копируем на сервер
scp neyroon-bot.tar.gz root@your-server-ip:/root/
```

**На сервере распаковываем:**
```bash
cd /root
tar -xzf neyroon-bot.tar.gz -C /opt
cd /opt/neyroon-bot
```

### 3. Настройте .env файл

```bash
cp .env.production.example .env
nano .env
```

Заполните все необходимые переменные:
- `BOT_TOKEN` - токен вашего бота
- `POSTGRES_PASSWORD` - надежный пароль для БД
- `ADMIN_SECRET` - секретный ключ для админки
- `JWT_SECRET` - секретный ключ для JWT
- Данные платежных систем (KASPI, PRODAMUS)

**Генерация секретов:**
```bash
# Сгенерируйте два случайных секрета
openssl rand -base64 32  # для ADMIN_SECRET
openssl rand -base64 32  # для JWT_SECRET
```

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4. Запустите автоматическое развертывание

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

Скрипт автоматически:
- Установит Docker и Docker Compose (если не установлены)
- Создаст необходимые директории
- Соберет и запустит контейнеры
- Проверит работу приложения

### 5. Готово! 🎉

Проверьте что всё работает:
```bash
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f bot
```

---

## Вариант 2: Ручное развертывание

### 1. Установите Docker

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Проверка установки
docker --version
docker-compose --version
```

### 2. Загрузите проект

```bash
cd /opt
# Вариант A: через Git
sudo git clone https://github.com/your-repo/neyroon-bot.git

# Вариант B: загрузите архив и распакуйте
```

### 3. Настройте переменные окружения

```bash
cd /opt/neyroon-bot
cp .env.production.example .env
nano .env
```

### 4. Запустите проект

```bash
# Создание директорий
mkdir -p uploads/drawings uploads/videos

# Запуск контейнеров
docker-compose -f docker-compose.prod.yml up -d

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f
```

---

## Настройка домена и SSL (опционально)

### 1. Установите Nginx

```bash
sudo apt install -y nginx
```

### 2. Создайте конфигурацию Nginx

```bash
sudo nano /etc/nginx/sites-available/neyroon-bot
```

Вставьте:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Активируйте конфигурацию

```bash
sudo ln -s /etc/nginx/sites-available/neyroon-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Установите SSL сертификат

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Автопродление
sudo certbot renew --dry-run
```

---

## Проверка работы

### Проверка контейнеров

```bash
docker-compose -f docker-compose.prod.yml ps
```

Должны быть запущены:
- `neyroon-bot` (running)
- `neyroon-postgres` (running)

### Проверка логов

```bash
# Логи бота
docker-compose -f docker-compose.prod.yml logs -f bot

# Логи базы данных
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### Проверка health endpoint

```bash
curl http://localhost:3000/health
```

Ответ должен быть:
```json
{"status":"ok","timestamp":"...","service":"neyroon-bot"}
```

### Доступ к админ панели

Откройте в браузере:
- `http://your-server-ip:3000/admin/`
- `https://your-domain.com/admin/` (если настроен SSL)

---

## Полезные команды

```bash
# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f

# Перезапуск
docker-compose -f docker-compose.prod.yml restart

# Остановка
docker-compose -f docker-compose.prod.yml down

# Обновление кода
git pull  # или загрузите новые файлы
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Резервное копирование базы данных
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U neyroon_user neyroon_bot > backup.sql

# Вход в контейнер
docker-compose -f docker-compose.prod.yml exec bot sh
```

---

## Настройка Firewall

```bash
# Установка UFW
sudo apt install -y ufw

# Базовые правила
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Разрешаем SSH
sudo ufw allow 22/tcp
# Или если изменили порт SSH:
# sudo ufw allow 2222/tcp

# Разрешаем HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включаем firewall
sudo ufw enable

# Проверка статуса
sudo ufw status
```

---

## Troubleshooting

### Проблема: Контейнеры не запускаются

```bash
# Проверьте логи
docker-compose -f docker-compose.prod.yml logs

# Пересоздайте контейнеры
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Проблема: Нет подключения к базе данных

```bash
# Проверьте, что PostgreSQL запущен
docker-compose -f docker-compose.prod.yml ps postgres

# Проверьте логи PostgreSQL
docker-compose -f docker-compose.prod.yml logs postgres

# Проверьте DATABASE_URL в .env
cat .env | grep DATABASE_URL
```

### Проблема: Порт 3000 уже занят

```bash
# Найдите процесс
sudo lsof -i :3000

# Остановите процесс
sudo kill -9 <PID>
```

### Проблема: Недостаточно памяти

```bash
# Создайте swap файл
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Мониторинг

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
df -h

# Использование памяти
free -h

# Логи системы
journalctl -xe
```

---

## Следующие шаги

1. ✅ Настройте домен и SSL
2. ✅ Настройте webhook URL в платежных системах (Kaspi, Prodamus)
3. ✅ Добавьте видео уроки через админ панель
4. ✅ Протестируйте весь процесс от регистрации до получения урока
5. ✅ Настройте резервное копирование (бэкапы БД и файлов)
6. ✅ Настройте мониторинг (опционально)

---

**Полная документация:** [DEPLOYMENT.md](DEPLOYMENT.md)
