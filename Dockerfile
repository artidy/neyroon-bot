# Базовый образ Node.js
FROM node:18-alpine

# Установка зависимостей для работы Prisma и bcrypt
RUN apk add --no-cache openssl python3 make g++

# Создание рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование остальных файлов проекта
COPY . .

# Установка dev зависимостей для сборки
RUN npm install --only=development

# Генерация Prisma Client с фейковым DATABASE_URL (нужен только для сборки)
ENV DATABASE_URL="postgresql://fake:fake@localhost:5432/fake?schema=public"
RUN npx prisma generate

# Сборка TypeScript
RUN npm run build

# Удаление dev зависимостей и очистка переменной
RUN npm prune --production
ENV DATABASE_URL=""

# Создание директории для загрузок
RUN mkdir -p /app/uploads/drawings

# Открытие портов
EXPOSE 3000

# Команда запуска
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
