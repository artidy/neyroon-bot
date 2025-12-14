# Полезные команды для управления сервером

## Быстрый доступ

### SSH подключение
```bash
ssh root@YOUR_SERVER_IP
# или
ssh -p 2222 root@YOUR_SERVER_IP  # если изменили порт
```

### Переход в директорию проекта
```bash
cd /opt/neyroon-bot
```

---

## Docker Compose команды

### Запуск
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Остановка
```bash
docker-compose -f docker-compose.prod.yml down
```

### Перезапуск
```bash
docker-compose -f docker-compose.prod.yml restart

# Перезапуск только бота
docker-compose -f docker-compose.prod.yml restart bot
```

### Статус контейнеров
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Логи
```bash
# Все логи в реальном времени
docker-compose -f docker-compose.prod.yml logs -f

# Только логи бота
docker-compose -f docker-compose.prod.yml logs -f bot

# Последние 50 строк
docker-compose -f docker-compose.prod.yml logs --tail 50 bot

# Логи базы данных
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### Пересборка после изменений
```bash
# Остановка
docker-compose -f docker-compose.prod.yml down

# Пересборка без кеша
docker-compose -f docker-compose.prod.yml build --no-cache

# Запуск
docker-compose -f docker-compose.prod.yml up -d
```

---

## Работа с контейнерами

### Вход в контейнер бота
```bash
docker-compose -f docker-compose.prod.yml exec bot sh
```

### Вход в PostgreSQL
```bash
docker-compose -f docker-compose.prod.yml exec postgres psql -U neyroon_user -d neyroon_bot
```

### Выполнение команды в контейнере
```bash
# Пример: проверка версии Node.js
docker-compose -f docker-compose.prod.yml exec bot node --version
```

---

## Мониторинг

### Использование ресурсов
```bash
# Реал-тайм мониторинг контейнеров
docker stats

# Одноразовый снимок
docker stats --no-stream

# Только для neyroon-bot
docker stats neyroon-bot --no-stream
```

### Использование диска
```bash
# Общее использование
df -h

# Docker использование
docker system df

# Размер контейнеров
docker ps -s
```

### Использование памяти
```bash
free -h
```

### Health check
```bash
curl http://localhost:3000/health
```

---

## База данных

### Резервное копирование
```bash
# Создание бэкапа
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U neyroon_user neyroon_bot > backup_$(date +%Y%m%d_%H%M%S).sql

# Создание бэкапа с gzip
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U neyroon_user neyroon_bot | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Восстановление из бэкапа
```bash
# Из обычного бэкапа
cat backup_20231215_120000.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U neyroon_user neyroon_bot

# Из gzip бэкапа
gunzip -c backup_20231215_120000.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U neyroon_user neyroon_bot
```

### Проверка данных
```bash
# Количество пользователей
docker-compose -f docker-compose.prod.yml exec postgres psql -U neyroon_user -d neyroon_bot -c "SELECT COUNT(*) FROM \"User\";"

# Количество уроков
docker-compose -f docker-compose.prod.yml exec postgres psql -U neyroon_user -d neyroon_bot -c "SELECT COUNT(*) FROM \"Lesson\";"

# Активные подписки
docker-compose -f docker-compose.prod.yml exec postgres psql -U neyroon_user -d neyroon_bot -c "SELECT COUNT(*) FROM \"Subscription\" WHERE status='completed' AND \"endDate\" > NOW();"
```

---

## Обновление проекта

### Через Git
```bash
cd /opt/neyroon-bot

# Получить изменения
git pull

# Пересобрать и перезапустить
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Проверить логи
docker-compose -f docker-compose.prod.yml logs -f bot
```

### Через загрузку файлов
```bash
# На локальном компьютере создайте архив
tar -czf neyroon-bot-update.tar.gz --exclude=node_modules --exclude=.git --exclude=uploads .

# Загрузите на сервер
scp neyroon-bot-update.tar.gz root@YOUR_SERVER_IP:/tmp/

# На сервере
cd /opt/neyroon-bot
docker-compose -f docker-compose.prod.yml down
tar -xzf /tmp/neyroon-bot-update.tar.gz
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

---

## Nginx (если используется)

### Перезапуск Nginx
```bash
sudo systemctl restart nginx
```

### Проверка конфигурации
```bash
sudo nginx -t
```

### Логи Nginx
```bash
# Access log
sudo tail -f /var/log/nginx/access.log

# Error log
sudo tail -f /var/log/nginx/error.log
```

### Обновление SSL сертификата
```bash
sudo certbot renew
sudo systemctl restart nginx
```

---

## Firewall (UFW)

### Статус
```bash
sudo ufw status
```

### Разрешить порт
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
```

### Удалить правило
```bash
sudo ufw delete allow 80/tcp
```

### Включить/выключить
```bash
sudo ufw enable
sudo ufw disable
```

---

## Очистка

### Остановка и удаление контейнеров
```bash
docker-compose -f docker-compose.prod.yml down
```

### Удаление неиспользуемых образов
```bash
docker image prune -a
```

### Удаление всех неиспользуемых данных
```bash
docker system prune -a --volumes
```

### Очистка логов
```bash
# Очистка логов Docker (будьте осторожны!)
sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log'
```

---

## Системные команды

### Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### Перезагрузка сервера
```bash
sudo reboot
```

### Просмотр использования портов
```bash
sudo netstat -tulpn | grep LISTEN
# или
sudo ss -tulpn | grep LISTEN
```

### Поиск процесса по порту
```bash
sudo lsof -i :3000
```

### Остановка процесса
```bash
sudo kill -9 <PID>
```

---

## Troubleshooting

### Контейнер не запускается
```bash
# Проверить логи
docker-compose -f docker-compose.prod.yml logs bot

# Пересоздать контейнер
docker-compose -f docker-compose.prod.yml up -d --force-recreate bot
```

### База данных недоступна
```bash
# Проверить статус PostgreSQL
docker-compose -f docker-compose.prod.yml ps postgres

# Перезапустить базу данных
docker-compose -f docker-compose.prod.yml restart postgres

# Проверить логи
docker-compose -f docker-compose.prod.yml logs postgres
```

### Нет места на диске
```bash
# Проверить использование диска
df -h

# Очистить Docker
docker system prune -a --volumes

# Удалить старые логи
sudo journalctl --vacuum-time=7d
```

### Высокое использование памяти
```bash
# Проверить память
free -h

# Проверить swap
swapon --show

# Перезапустить контейнеры
docker-compose -f docker-compose.prod.yml restart
```

---

## Автоматизация

### Настройка cron для бэкапов
```bash
# Редактировать crontab
crontab -e

# Добавить задачу (бэкап каждый день в 3:00)
0 3 * * * cd /opt/neyroon-bot && docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U neyroon_user neyroon_bot | gzip > /backups/neyroon_bot_$(date +\%Y\%m\%d).sql.gz
```

### Скрипт для быстрого обновления
```bash
# Создайте файл update.sh
nano /opt/neyroon-bot/update.sh

# Добавьте:
#!/bin/bash
cd /opt/neyroon-bot
git pull
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml logs -f bot

# Сделайте исполняемым
chmod +x /opt/neyroon-bot/update.sh

# Использование
/opt/neyroon-bot/update.sh
```

---

## Быстрая справка

```bash
# Статус всего
docker-compose -f docker-compose.prod.yml ps && docker stats --no-stream && df -h && free -h

# Полный перезапуск
docker-compose -f docker-compose.prod.yml down && docker-compose -f docker-compose.prod.yml up -d

# Проверка здоровья
curl http://localhost:3000/health && docker-compose -f docker-compose.prod.yml logs --tail 20 bot
```

---

**Сохраните этот файл для быстрого доступа к командам!**
