# Развертывание на VPS

## Требования на сервере

- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Docker и Docker Compose
- Минимум 1GB RAM (рекомендуется 2GB)
- 10GB свободного места на диске
- Открытые порты: 80, 443, 3000

## Шаг 1: Подключение к серверу

```bash
ssh root@your-server-ip
# или
ssh username@your-server-ip
```

## Шаг 2: Установка Docker

### Ubuntu/Debian:
```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Установка зависимостей
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Добавление Docker GPG ключа
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Добавление Docker репозитория
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Добавление пользователя в группу docker (опционально)
sudo usermod -aG docker $USER
```

### CentOS/RHEL:
```bash
sudo yum update -y
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker
```

## Шаг 3: Загрузка проекта на сервер

### Вариант A: Через Git (рекомендуется)

```bash
# Установка Git (если не установлен)
sudo apt install -y git

# Клонирование проекта
cd /opt
sudo git clone https://github.com/your-username/neyroon-bot.git
cd neyroon-bot
```

### Вариант B: Через SCP

На локальном компьютере:
```bash
# Создаем архив проекта (исключая node_modules и .git)
tar -czf neyroon-bot.tar.gz --exclude=node_modules --exclude=.git --exclude=uploads .

# Копируем на сервер
scp neyroon-bot.tar.gz root@your-server-ip:/opt/

# На сервере распаковываем
ssh root@your-server-ip
cd /opt
tar -xzf neyroon-bot.tar.gz
mv neyroon-bot-main neyroon-bot  # если нужно
cd neyroon-bot
```

### Вариант C: Через SFTP клиент

Используйте FileZilla, WinSCP или другой SFTP клиент:
1. Подключитесь к серверу
2. Загрузите папку проекта в `/opt/neyroon-bot`

## Шаг 4: Настройка .env файла

```bash
cd /opt/neyroon-bot

# Создаем .env из примера
cp .env.example .env

# Редактируем .env
nano .env
```

Заполните все переменные:

```env
# Telegram Bot
BOT_TOKEN=your_real_bot_token

# Database
DATABASE_URL="postgresql://neyroon_user:secure_password_here@postgres:5432/neyroon_bot?schema=public"

# Payment Systems
KASPI_MERCHANT_ID=your_kaspi_id
KASPI_MERCHANT_SECRET=your_kaspi_secret
PRODAMUS_API_KEY=your_prodamus_key
PRODAMUS_SECRET_KEY=your_prodamus_secret
PRODAMUS_PROJECT_ID=your_project_id

# Bot Settings
BOT_USERNAME=your_bot_username
WEBHOOK_URL=https://your-domain.com

# Subscription Settings
SUBSCRIPTION_PRICE=4000
SUBSCRIPTION_CURRENCY=KZT
SUBSCRIPTION_DURATION_DAYS=30

# Admin Panel
ADMIN_PORT=3000
ADMIN_SECRET=your_secure_admin_secret_key
JWT_SECRET=your_secure_jwt_secret

# File Storage
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Scheduler
TIMEZONE=Asia/Almaty
DEFAULT_LESSON_TIME=10:00
```

**Важно:** Замените все пароли и секретные ключи на надежные!

Сохраните файл: `Ctrl+O`, `Enter`, `Ctrl+X`

## Шаг 5: Запуск проекта

```bash
# Запуск в production режиме
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f
```

## Шаг 6: Проверка работы

```bash
# Проверка, что контейнеры запущены
docker-compose ps

# Должны видеть:
# neyroon-bot       running
# neyroon-postgres  running

# Проверка логов бота
docker-compose logs bot --tail 50

# Должны увидеть:
# ✅ Database connected
# ✅ Lessons initialized
# ✅ Bot started successfully!
```

## Шаг 7: Настройка домена (опционально)

Если у вас есть домен, настройте его на IP сервера:

### A. DNS настройки

В панели управления доменом добавьте A-запись:
```
Type: A
Name: @ (или bot)
Value: your-server-ip
TTL: 3600
```

### B. Установка Nginx

```bash
sudo apt install -y nginx

# Создаем конфигурацию
sudo nano /etc/nginx/sites-available/neyroon-bot
```

Добавьте:
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

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/neyroon-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### C. Установка SSL (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Автопродление
sudo certbot renew --dry-run
```

## Шаг 8: Настройка автозапуска

Docker Compose автоматически настроит перезапуск контейнеров при перезагрузке сервера (благодаря `restart: always` в docker-compose.yml).

Проверьте:
```bash
sudo reboot

# После перезагрузки подключитесь снова
ssh root@your-server-ip

# Проверьте статус
docker-compose ps
```

## Обновление проекта

Когда нужно обновить код:

```bash
cd /opt/neyroon-bot

# Через Git
git pull

# Или через загрузку новых файлов
# ...

# Пересборка и перезапуск
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Проверка логов
docker-compose logs -f bot
```

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f bot
docker-compose logs -f postgres

# Остановка
docker-compose down

# Запуск
docker-compose up -d

# Перезапуск
docker-compose restart

# Статус контейнеров
docker-compose ps

# Вход в контейнер
docker-compose exec bot sh

# Просмотр использования ресурсов
docker stats

# Очистка неиспользуемых образов
docker system prune -a
```

## Резервное копирование

### Бэкап базы данных

```bash
# Создание бэкапа
docker-compose exec -T postgres pg_dump -U neyroon_user neyroon_bot > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из бэкапа
cat backup_20231215_120000.sql | docker-compose exec -T postgres psql -U neyroon_user neyroon_bot
```

### Бэкап файлов

```bash
# Создание архива uploads
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz uploads/

# Восстановление
tar -xzf uploads_backup_20231215_120000.tar.gz
```

## Мониторинг

### Просмотр использования ресурсов

```bash
# CPU, RAM, Network
docker stats

# Дисковое пространство
df -h

# Размер Docker контейнеров
docker system df
```

### Настройка логирования

Логи хранятся в Docker, но можно настроить ротацию:

```bash
# Создайте /etc/docker/daemon.json
sudo nano /etc/docker/daemon.json
```

Добавьте:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Перезапустите Docker:
```bash
sudo systemctl restart docker
```

## Troubleshooting

### Проблема: Бот не запускается

```bash
# Проверьте логи
docker-compose logs bot

# Проверьте .env файл
cat .env

# Проверьте подключение к БД
docker-compose exec postgres psql -U neyroon_user -d neyroon_bot -c "SELECT 1;"
```

### Проблема: База данных не подключается

```bash
# Проверьте статус PostgreSQL
docker-compose ps postgres

# Проверьте логи PostgreSQL
docker-compose logs postgres

# Пересоздайте контейнер БД
docker-compose down
docker volume rm neyroon-bot_postgres_data
docker-compose up -d
```

### Проблема: Порт 3000 занят

```bash
# Найдите процесс на порту 3000
sudo lsof -i :3000

# Остановите процесс
sudo kill -9 <PID>

# Или измените порт в docker-compose.yml
```

### Проблема: Недостаточно памяти

```bash
# Проверьте использование памяти
free -h

# Создайте swap файл (если нет)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Безопасность

1. **Firewall (UFW)**

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **Fail2Ban**

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

3. **Регулярные обновления**

```bash
sudo apt update && sudo apt upgrade -y
```

4. **Смена SSH порта** (опционально)

```bash
sudo nano /etc/ssh/sshd_config
# Измените Port 22 на Port 2222
sudo systemctl restart sshd
sudo ufw allow 2222/tcp
```

## Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs -f`
2. Проверьте статус: `docker-compose ps`
3. Проверьте .env файл
4. Обратитесь к документации: [README.md](README.md)
