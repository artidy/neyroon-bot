@echo off
chcp 1251 >nul
echo ================================================
echo   Neyroon Bot - Запуск в Docker
echo ================================================
echo.

REM Проверка Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Docker не найден!
    echo Установите Docker Desktop: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [OK] Docker найден
echo.

REM Проверка .env
if not exist .env (
    echo [ВНИМАНИЕ] Файл .env не найден!
    echo Создайте файл .env на основе .env.example
    pause
    exit /b 1
)

echo [OK] Файл .env найден
echo.

echo Выберите режим запуска:
echo.
echo 1 - Разработка (с hot-reload)
echo 2 - Продакшн
echo 3 - Только Prisma Studio
echo 4 - Остановить все контейнеры
echo 5 - Показать логи
echo.

set /p choice="Ваш выбор (1-5): "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto prod
if "%choice%"=="3" goto studio
if "%choice%"=="4" goto stop
if "%choice%"=="5" goto logs
goto invalid

:dev
echo.
echo [Запуск в режиме разработки...]
echo.
docker-compose -f docker-compose.dev.yml up
goto end

:prod
echo.
echo [Запуск в режиме продакшн...]
echo.
docker-compose up -d
echo.
echo [OK] Бот запущен в фоновом режиме
echo Админ панель: http://localhost:3000/admin/
echo Логи: docker-compose logs -f
goto end

:studio
echo.
echo [Запуск Prisma Studio...]
echo.
docker-compose -f docker-compose.dev.yml up prisma-studio
goto end

:stop
echo.
echo [Остановка всех контейнеров...]
docker-compose -f docker-compose.dev.yml down
docker-compose down
echo [OK] Все контейнеры остановлены
goto end

:logs
echo.
echo [Просмотр логов (Ctrl+C для выхода)...]
echo.
docker-compose -f docker-compose.dev.yml logs -f
goto end

:invalid
echo.
echo [ОШИБКА] Неверный выбор
goto end

:end
echo.
pause
