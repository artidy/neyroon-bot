# Настройка Monorepo (несколько проектов в одном репозитории)

## Вариант: Несколько проектов в одной папке

Если хотите хранить несколько проектов в одном GitHub репозитории:

### Шаг 1: Реорганизуйте структуру

```
my-projects/
├── neyroon-bot/           ← текущий проект перемещается сюда
│   ├── src/
│   ├── package.json
│   ├── docker-compose.yml
│   └── README.md
│
├── project-2/             ← новый проект
│   └── ...
│
└── README.md              ← главный README для всех проектов
```

### Шаг 2: Переместите текущий проект

```bash
# 1. Создайте новую папку-родитель
mkdir d:\projects\my-workspace
cd d:\projects\my-workspace

# 2. Переместите neyroon-bot
move d:\projects\neyroon-bot d:\projects\my-workspace\neyroon-bot

# 3. Инициализируйте Git в корне
cd d:\projects\my-workspace
git init
git branch -M main

# 4. Создайте главный README.md
echo "# My Projects" > README.md
echo "" >> README.md
echo "## Projects:" >> README.md
echo "- [Neyroon Bot](neyroon-bot/) - Telegram bot for drawing courses" >> README.md
```

### Шаг 3: Настройте .gitignore

```bash
# В корне my-workspace создайте .gitignore
cat > .gitignore << 'EOF'
# Node modules в любом проекте
**/node_modules/
**/dist/

# Environment files
**/.env

# Uploads
**/uploads/drawings/*
!**/uploads/drawings/.gitkeep

# Logs
**/*.log

# IDE
.vscode/
.idea/
**/.DS_Store
EOF
```

### Шаг 4: Настройте CI/CD для каждого проекта

`.github/workflows/deploy-neyroon-bot.yml`:
```yaml
name: Deploy Neyroon Bot

on:
  push:
    branches:
      - main
    paths:
      - 'neyroon-bot/**'  # Запускаться только при изменении этого проекта

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.NEYROON_VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            cd /opt/neyroon-bot
            git pull origin main

            # Переходим в папку конкретного проекта
            cd neyroon-bot

            docker-compose -f docker-compose.prod.yml down
            docker-compose -f docker-compose.prod.yml build --no-cache
            docker-compose -f docker-compose.prod.yml up -d
```

### Шаг 5: Добавьте все в Git

```bash
cd d:\projects\my-workspace

git add .
git commit -m "Initial commit: Monorepo with multiple projects"

git remote add origin https://github.com/YOUR_USERNAME/my-workspace.git
git push -u origin main
```

---

## Преимущества Monorepo

✅ Все проекты в одном месте
✅ Общие зависимости
✅ Одна история коммитов
✅ Легко переиспользовать код между проектами

## Недостатки Monorepo

❌ Сложнее CI/CD (нужно определять какой проект изменился)
❌ Все проекты клонируются вместе (даже если нужен только один)
❌ Большой размер репозитория со временем

---

## Альтернатива: Используйте GitHub Organizations

Создайте организацию на GitHub и добавьте туда все проекты:

1. GitHub → Settings → Organizations → New organization
2. Создайте организацию (например: `my-company`)
3. Создавайте репозитории внутри организации:
   - `my-company/neyroon-bot`
   - `my-company/project-2`
   - `my-company/project-3`

**Преимущества:**
- ✅ Все проекты под одной крышей
- ✅ Каждый проект независим
- ✅ Удобное управление правами доступа для команды

---

## Рекомендация

Для коммерческого проекта как Neyroon Bot:

**Создайте отдельный репозиторий:**
- Проще управлять
- Независимый CI/CD
- Легче клонировать
- Чистая история

Monorepo используйте только если проекты тесно связаны (например: frontend + backend одного приложения).
