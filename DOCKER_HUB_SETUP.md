# Настройка Docker Hub для автоматического деплоя

## Шаг 1: Создайте Access Token на Docker Hub

1. Войдите на https://hub.docker.com
2. Перейдите в **Account Settings** → **Security**
3. Нажмите **New Access Token**
4. Заполните:
   - **Description**: `GitHub Actions neyroon-bot`
   - **Access permissions**: **Read, Write, Delete**
5. Нажмите **Generate**
6. **СКОПИРУЙТЕ токен** (он показывается только один раз!)

---

## Шаг 2: Добавьте секреты в GitHub

Перейдите в ваш репозиторий на GitHub:
`https://github.com/artidy/neyroon-bot/settings/secrets/actions`

### В Repository secrets добавьте:

1. **DOCKER_USERNAME**
   - Value: ваш логин на Docker Hub

2. **DOCKER_PASSWORD**
   - Value: Access Token который вы скопировали на шаге 1

---

## Шаг 3: Настройте VPS сервер (один раз)

Подключитесь к вашему VPS и выполните:

```bash
# 1. Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 2. Установить Docker Compose (встроенный плагин)
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# 3. Создать директорию проекта
sudo mkdir -p /opt/neyroon-bot
sudo chown -R $USER:$USER /opt/neyroon-bot

# 4. Скопировать только docker-compose.prod.yml на сервер
cd /opt/neyroon-bot
```

### Создайте файл docker-compose.prod.yml на сервере:

```bash
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    container_name: neyroon-postgres
    restart: always
    environment:
      POSTGRES_USER: neyroon_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: neyroon_bot
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - neyroon-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U neyroon_user -d neyroon_bot"]
      interval: 10s
      timeout: 5s
      retries: 5

  bot:
    image: ${DOCKER_IMAGE:-neyroon-bot:latest}
    container_name: neyroon-bot
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://neyroon_user:${POSTGRES_PASSWORD:-changeme}@postgres:5432/neyroon_bot?schema=public
    env_file:
      - .env
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
    networks:
      - neyroon-network
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  neyroon-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
EOF
```

### Создайте папку для загрузок:

```bash
mkdir -p /opt/neyroon-bot/uploads/{drawings,videos,welcome}
```

---

## Шаг 4: Как работает автодеплой

### При каждом `git push` в ветку `main`:

1. **GitHub Actions собирает Docker образ**
   - Использует Dockerfile из репозитория
   - Оптимизирует сборку с кэшированием слоев
   - Присваивает теги: `latest` и `main-{sha}`

2. **Пушит образ в Docker Hub**
   - Образ загружается в `DOCKER_USERNAME/neyroon-bot:latest`

3. **Подключается к VPS**
   - Создает `.env` файл из GitHub Secrets
   - Скачивает свежий образ: `docker pull`
   - Останавливает старые контейнеры
   - Запускает новые контейнеры с новым образом

4. **Проверяет health endpoint**
   - Если проверка не прошла - деплой считается failed

---

## Преимущества такого подхода

✅ **Быстрый деплой** - образ уже собран, просто скачивается
✅ **Экономия ресурсов VPS** - не нужно собирать образ на сервере
✅ **Версионирование** - каждый коммит имеет свой тег образа
✅ **Легкий откат** - просто запустите предыдущую версию:
```bash
docker pull DOCKER_USERNAME/neyroon-bot:main-abc1234
DOCKER_IMAGE=DOCKER_USERNAME/neyroon-bot:main-abc1234 docker compose up -d
```

✅ **Кэширование** - повторные сборки быстрее благодаря layer cache
✅ **Портативность** - можно развернуть на любом сервере с Docker

---

## Первый деплой

После настройки секретов сделайте:

```bash
git add .
git commit -m "Configure Docker Hub deployment"
git push
```

GitHub Actions автоматически:
1. Соберет образ
2. Загрузит в Docker Hub
3. Развернет на VPS

Следите за процессом: https://github.com/artidy/neyroon-bot/actions

---

## Откат на предыдущую версию

Если что-то пошло не так:

```bash
# На VPS:
cd /opt/neyroon-bot

# Посмотреть доступные версии
docker images | grep neyroon-bot

# Откатиться на конкретную версию
DOCKER_IMAGE=DOCKER_USERNAME/neyroon-bot:main-abc1234 docker compose -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

### Ошибка: "unauthorized: incorrect username or password"
- Проверьте `DOCKER_USERNAME` и `DOCKER_PASSWORD` в GitHub Secrets
- Убедитесь что используете Access Token, а не пароль от аккаунта

### Ошибка: "manifest unknown"
- Образ еще не собран, дождитесь первого успешного workflow

### Ошибка на VPS: "permission denied"
- Добавьте пользователя в группу docker: `sudo usermod -aG docker $USER`
- Перелогиньтесь: `exit` и войдите заново

### Контейнеры не запускаются
```bash
# Проверить логи
docker compose -f docker-compose.prod.yml logs bot
docker compose -f docker-compose.prod.yml logs postgres

# Проверить статус
docker compose -f docker-compose.prod.yml ps
```

---

## Полезные команды

```bash
# Посмотреть логи бота
docker compose -f docker-compose.prod.yml logs -f bot

# Перезапустить бота
docker compose -f docker-compose.prod.yml restart bot

# Полная переустановка
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d

# Обновить до последней версии вручную
docker pull DOCKER_USERNAME/neyroon-bot:latest
docker compose -f docker-compose.prod.yml up -d
```
