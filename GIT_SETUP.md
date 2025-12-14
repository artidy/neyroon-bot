# Настройка Git и загрузка на GitHub

## Шаг 1: Создайте репозиторий на GitHub

1. Откройте https://github.com
2. Войдите в свой аккаунт
3. Нажмите "+" → "New repository"
4. Заполните:
   - **Repository name**: `neyroon-bot`
   - **Description**: `Telegram бот для курсов рисования`
   - **Visibility**: **Private** ⚠️ (важно для коммерческого проекта!)
   - ⚠️ **НЕ ставьте галочки** на "Add a README file", ".gitignore", "license"
5. Нажмите "Create repository"
6. **Скопируйте URL репозитория** (будет показан на следующей странице)
   - Например: `https://github.com/YOUR_USERNAME/neyroon-bot.git`

---

## Шаг 2: Проверьте, что .env НЕ будет загружен

⚠️ **КРИТИЧЕСКИ ВАЖНО!** Файл `.env` содержит секреты и НЕ должен попасть в GitHub.

Проверьте `.gitignore`:

```bash
# В PowerShell/CMD
type .gitignore | findstr .env

# Должно показать:
# .env
```

Если `.env` есть в `.gitignore` - отлично! Если нет - добавьте его.

---

## Шаг 3: Инициализируйте Git локально

Откройте PowerShell/CMD в папке проекта `d:\projects\neyroon-bot` и выполните:

```bash
# 1. Инициализация Git
git init

# 2. Настройка имени и email (если еще не настроено)
git config --global user.name "Ваше Имя"
git config --global user.email "your.email@example.com"

# 3. Создание основной ветки main
git branch -M main
```

---

## Шаг 4: Добавьте файлы в Git

```bash
# 1. Добавить все файлы
git add .

# 2. Проверить статус (убедитесь, что .env НЕ в списке!)
git status

# Вы должны увидеть много файлов, но НЕ .env
# Если .env в списке - ОСТАНОВИТЕСЬ и проверьте .gitignore!

# 3. Создать первый коммит
git commit -m "Initial commit: Neyroon Bot - Telegram bot for drawing courses"
```

---

## Шаг 5: Подключите удаленный репозиторий

```bash
# Замените YOUR_USERNAME на ваше имя пользователя GitHub
git remote add origin https://github.com/YOUR_USERNAME/neyroon-bot.git

# Проверьте, что remote добавлен
git remote -v
```

---

## Шаг 6: Загрузите проект на GitHub

```bash
# Первая загрузка (может потребоваться ввести GitHub пароль/токен)
git push -u origin main
```

### Если запросит авторизацию:

**Windows:**
- Откроется окно авторизации GitHub
- Войдите в свой аккаунт
- Разрешите доступ

**Если не работает (старый способ):**
1. Создайте Personal Access Token:
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token (classic)
   - Выберите scopes: `repo` (все галочки)
   - Скопируйте токен
2. При запросе пароля вставьте токен вместо пароля

---

## Шаг 7: Проверьте загрузку

1. Откройте ваш репозиторий на GitHub: `https://github.com/YOUR_USERNAME/neyroon-bot`
2. Убедитесь, что все файлы загружены
3. ⚠️ **ПРОВЕРЬТЕ:** файла `.env` НЕ должно быть в списке!

---

## ✅ Готово!

Теперь ваш проект на GitHub и вы можете настроить CI/CD!

---

## Следующие шаги:

### 1. Настройте CI/CD для автодеплоя
Следуйте инструкции: [AUTO_DEPLOY_QUICK.md](AUTO_DEPLOY_QUICK.md)

### 2. Разверните на VPS
Следуйте инструкции: [QUICK_DEPLOY.md](QUICK_DEPLOY.md)

---

## Полезные Git команды

```bash
# Проверить статус
git status

# Добавить изменения
git add .

# Создать коммит
git commit -m "Описание изменений"

# Загрузить на GitHub
git push

# Посмотреть историю
git log --oneline

# Создать новую ветку
git checkout -b feature-name

# Переключиться на ветку
git checkout main

# Слить ветку
git merge feature-name
```

---

## Работа с .env

### ⚠️ НИКОГДА не коммитьте .env файл!

Вместо этого:
1. Используйте `.env.example` с пустыми значениями
2. На сервере создайте `.env` из примера
3. В CI/CD используйте GitHub Secrets

### Проверка перед коммитом:

```bash
# Убедитесь, что .env НЕ будет добавлен
git status | findstr .env

# Если показывает .env - удалите из staging
git reset .env
```

---

## Troubleshooting

### Ошибка: "remote origin already exists"

```bash
# Удалите существующий remote
git remote remove origin

# Добавьте заново
git remote add origin https://github.com/YOUR_USERNAME/neyroon-bot.git
```

### Ошибка: "Permission denied"

Создайте Personal Access Token (см. Шаг 6) и используйте его вместо пароля.

### Случайно закоммитили .env

```bash
# НЕМЕДЛЕННО удалите из истории
git rm --cached .env
git commit -m "Remove .env from git"
git push

# Смените ВСЕ секреты из .env файла!
# - Новый BOT_TOKEN
# - Новые пароли БД
# - Новые ключи API
```

---

## GitHub Desktop (альтернатива)

Если не хотите использовать командную строку, можете использовать **GitHub Desktop**:

1. Скачайте: https://desktop.github.com/
2. Установите и войдите в GitHub аккаунт
3. File → Add Local Repository → выберите папку `d:\projects\neyroon-bot`
4. Publish repository
5. Готово!

---

**После загрузки проекта на GitHub переходите к настройке CI/CD:** [AUTO_DEPLOY_QUICK.md](AUTO_DEPLOY_QUICK.md)
