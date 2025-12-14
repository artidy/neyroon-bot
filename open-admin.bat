@echo off
chcp 65001 >nul
:: Скрипт для быстрого открытия админ панели

echo ================================================
echo   Neyroon Bot - Админ Панель
echo ================================================
echo.

:: Проверяем, запущен ли контейнер
docker ps | findstr neyroon-bot-dev >nul 2>&1
if errorlevel 1 (
    echo ❌ Бот не запущен!
    echo.
    echo Сначала запустите бота:
    echo   start.bat
    echo.
    pause
    exit /b 1
)

echo ✅ Бот запущен
echo.

:: Получаем IP адреса
echo 🌐 Доступные адреса:
echo.
echo   Локально (этот компьютер):
echo   http://localhost:3000/admin/
echo.

:: Показываем сетевые IP
echo   Из локальной сети:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do (
    set IP=%%a
    set IP=!IP: =!
    echo   http://!IP!:3000/admin/
)
echo.

:: Спрашиваем, что открыть
echo Что открыть?
echo.
echo 1 - Админ панель (localhost)
echo 2 - API Health Check
echo 3 - Показать логи бота
echo 4 - Открыть ngrok (для интернет доступа)
echo 0 - Выход
echo.

set /p choice="Ваш выбор (0-4): "

if "%choice%"=="1" (
    echo.
    echo 🌐 Открываю админ панель в браузере...
    start http://localhost:3000/admin/
    echo.
    echo ✅ Админ панель открыта!
    echo.
    echo 💡 Подсказка: Токен для API берите из .env (ADMIN_SECRET)
    echo.
    pause
    exit /b 0
)

if "%choice%"=="2" (
    echo.
    echo 🔍 Проверяю API Health...
    echo.
    curl -s http://localhost:3000/health
    echo.
    echo.
    pause
    exit /b 0
)

if "%choice%"=="3" (
    echo.
    echo 📋 Логи бота (Ctrl+C для выхода):
    echo.
    docker logs -f neyroon-bot-dev
    exit /b 0
)

if "%choice%"=="4" (
    echo.
    echo 🌍 Запуск ngrok...
    echo.
    if exist start-ngrok.bat (
        start-ngrok.bat
    ) else (
        echo ❌ Файл start-ngrok.bat не найден!
        echo Создайте его или используйте: ngrok http 3000
    )
    exit /b 0
)

if "%choice%"=="0" (
    exit /b 0
)

echo.
echo ❌ Неверный выбор
pause
