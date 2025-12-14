# Интеграция с Kaspi.kz

## Обзор

Этот проект интегрирован с платежной системой Kaspi.kz для приема оплаты за подписки на курс рисования.

## Настройка

### 1. Регистрация в Kaspi Business

1. Зарегистрируйтесь как мерчант на [Kaspi Business](https://business.kaspi.kz/)
2. Пройдите процедуру верификации
3. Получите доступ к API в личном кабинете

### 2. Получение учетных данных

В личном кабинете Kaspi Business найдите:
- **Merchant ID** - уникальный идентификатор вашего магазина
- **Merchant Secret** - секретный ключ для API запросов

### 3. Настройка переменных окружения

Добавьте следующие переменные в ваш `.env` файл:

```env
# Kaspi.kz
KASPI_MERCHANT_ID=ваш_merchant_id
KASPI_MERCHANT_SECRET=ваш_secret_key

# Bot Settings
BOT_USERNAME=ваш_bot_username
WEBHOOK_URL=https://ваш-домен.com
```

### 4. Настройка Webhook в Kaspi

В личном кабинете Kaspi Business укажите URL для получения уведомлений о платежах:

```
https://ваш-домен.com/api/payments/kaspi/webhook
```

## Как это работает

### Процесс оплаты

1. **Создание платежа**
   - Пользователь нажимает кнопку "Оплатить подписку"
   - Бот создает запись о подписке в БД со статусом `pending`
   - Отправляется запрос к Kaspi API для создания платежной ссылки
   - Пользователь получает ссылку на оплату

2. **Оплата**
   - Пользователь переходит по ссылке и оплачивает в Kaspi
   - Kaspi обрабатывает платеж

3. **Подтверждение**
   - Kaspi отправляет webhook на ваш сервер
   - Сервер обновляет статус подписки на `completed`
   - Пользователю активируется доступ к урокам
   - Бот отправляет уведомление о успешной оплате
   - Пользователь выбирает удобное время для получения уроков

### Основные файлы

#### `src/services/paymentService.ts`
Содержит логику создания платежей и проверки статусов:
- `createKaspiPaymentLink()` - создание ссылки на оплату
- `confirmPayment()` - подтверждение успешной оплаты
- `checkPaymentStatus()` - проверка статуса платежа

#### `src/admin/server.ts`
Содержит endpoints для работы с платежами:
- `POST /api/payments/kaspi/webhook` - прием уведомлений от Kaspi
- `GET /api/payments/kaspi/:paymentId/status` - проверка статуса платежа

#### `src/bot/index.ts`
Обработчики кнопок для работы с платежами:
- `show_payment` - показать варианты оплаты
- `payment_kaspi` - создать платеж через Kaspi
- `payment_check` - проверить статус оплаты
- `payment_decline` - отказ от оплаты

#### `src/bot/notifications.ts`
Функции для отправки уведомлений пользователям:
- `sendPaymentSuccessNotification()` - уведомление об успешной оплате
- `sendPaymentFailedNotification()` - уведомление о неудачной оплате
- `sendManualSubscriptionNotification()` - уведомление при ручном добавлении подписки

## API Endpoints

### Webhook от Kaspi
```
POST /api/payments/kaspi/webhook
```

**Тело запроса (от Kaspi):**
```json
{
  "payment_id": "KSP123456789",
  "status": "success",
  "order_id": "subscription-uuid",
  "amount": 4000,
  "currency": "KZT",
  "metadata": {
    "user_id": "user-uuid",
    "subscription_id": "subscription-uuid"
  }
}
```

**Статусы платежа:**
- `success` / `completed` - платеж успешен
- `failed` / `cancelled` - платеж не прошел
- `pending` / `processing` - платеж в обработке

### Проверка статуса платежа (вручную)
```
GET /api/payments/kaspi/:paymentId/status
Authorization: Bearer ADMIN_SECRET
```

## Тестирование

### Локальное тестирование webhook

Для локального тестирования используйте [ngrok](https://ngrok.com/):

```bash
# Запустите ngrok для проброса локального порта
ngrok http 3000

# Используйте полученный URL в настройках webhook Kaspi
https://your-ngrok-url.ngrok.io/api/payments/kaspi/webhook
```

### Тестовый платеж

1. Создайте тестового пользователя в боте
2. Нажмите "Оплатить подписку"
3. Выберите Kaspi.kz
4. Перейдите по ссылке (в тестовом режиме Kaspi предоставляет тестовые карты)
5. Проверьте, что webhook был получен и подписка активирована

### Ручное добавление подписки (для тестирования)

Через админ-панель можно вручную добавить подписку пользователю:

```
POST /api/users/:userId/subscription
Authorization: Bearer ADMIN_SECRET
Content-Type: application/json

{
  "durationDays": 30
}
```

## Безопасность

### Проверка подписи webhook (TODO)

В текущей версии закомментирована проверка подписи запросов от Kaspi.
Рекомендуется реализовать эту проверку для продакшена:

```typescript
// В server.ts, строка 287-290
const signature = req.headers['x-kaspi-signature'];
if (!verifyKaspiSignature(req.body, signature)) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

Функция `verifyKaspiSignature` должна проверять подпись с использованием `KASPI_MERCHANT_SECRET`.

### Рекомендации по безопасности

1. Всегда проверяйте подпись webhook-запросов
2. Используйте HTTPS для production
3. Храните `KASPI_MERCHANT_SECRET` в безопасности
4. Не выставляйте admin endpoints без авторизации
5. Логируйте все платежные операции

## Ручное подтверждение платежа

Если webhook от Kaspi не пришел, но вы видите оплату в системе Kaspi, можно подтвердить платеж вручную через админ-панель:

### Через админ-панель

1. Откройте админ-панель: http://localhost:3000/admin/
2. Перейдите во вкладку "Платежи"
3. В разделе "Ожидающие подтверждения" вы увидите список всех pending платежей
4. Нажмите кнопку "✅ Подтвердить" напротив нужного платежа
5. Подтвердите действие в диалоговом окне
6. Пользователь автоматически получит уведомление и доступ к урокам

### Через API

```bash
curl -X POST http://localhost:3000/api/payments/{subscriptionId}/confirm \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"paymentId": "MANUAL-123456789"}'
```

### Что происходит при ручном подтверждении:

1. Статус подписки меняется с `pending` на `completed`
2. Устанавливаются даты начала и окончания подписки
3. Статус пользователя меняется на `ACTIVE`
4. Пользователю отправляется уведомление через бота
5. Пользователю предлагается выбрать время для получения уроков

## Troubleshooting

### Webhook не приходит

1. Проверьте правильность URL в настройках Kaspi
2. Убедитесь, что URL доступен из интернета (не localhost)
3. Проверьте логи сервера на наличие ошибок
4. Используйте ngrok для локального тестирования
5. **Решение**: Используйте ручное подтверждение через админ-панель

### Платеж не подтверждается

1. Проверьте логи webhook-запросов
2. Убедитесь, что статус от Kaspi = "success" или "completed"
3. Проверьте, что order_id соответствует subscriptionId в БД
4. Проверьте, что БД была обновлена
5. **Решение**: Используйте ручное подтверждение через админ-панель

### Пользователь не получает уведомление

1. Проверьте, что бот запущен и работает
2. Убедитесь, что `setBotInstance()` вызывается при старте
3. Проверьте, что telegramId корректный
4. Посмотрите логи на наличие ошибок при отправке

## API Reference Kaspi.kz

Документация API Kaspi.kz (актуализируйте согласно официальной документации):

### Создание платежа
```
POST https://api.kaspi.kz/pay/v1/payments
Authorization: Bearer {MERCHANT_SECRET}
X-Merchant-ID: {MERCHANT_ID}

{
  "merchant_id": "...",
  "amount": "4000",
  "currency": "KZT",
  "order_id": "...",
  "description": "...",
  "success_url": "...",
  "failure_url": "...",
  "callback_url": "..."
}
```

### Проверка статуса платежа
```
GET https://api.kaspi.kz/pay/v1/payments/{payment_id}
Authorization: Bearer {MERCHANT_SECRET}
X-Merchant-ID: {MERCHANT_ID}
```

## Дальнейшие улучшения

- [ ] Добавить проверку подписи webhook
- [ ] Реализовать автоматический возврат средств (refund)
- [ ] Добавить логирование всех платежных операций в отдельную таблицу
- [ ] Реализовать повторные попытки при ошибках API
- [ ] Добавить дашборд с аналитикой платежей
- [ ] Поддержка разных тарифов подписки
- [ ] Интеграция с другими платежными системами (ЮKassa, Stripe)

## Поддержка

По вопросам интеграции с Kaspi.kz обращайтесь в техподдержку Kaspi Business или к вашему менеджеру.
