# 🌳 Родовідне Дерево (Family Tree)

Колективна цифрова платформа для збереження та перегляду генеалогічних даних родини.

## Стек

- **Backend**: Node.js + Express + PostgreSQL + Socket.io
- **Frontend**: React + Vite + React Flow + Tailwind CSS
- **Telegram Bot**: Grammy.js
- **Hosting**: Railway

## Структура проєкту

```
rodovod/
├── backend/          # Express API сервер
│   ├── src/
│   │   ├── config/   # DB, конфіги
│   │   ├── middleware/ # Auth, roles
│   │   ├── routes/   # REST API endpoints
│   │   ├── services/ # Telegram auth
│   │   └── migrations/ # SQL схема БД
├── frontend/         # React SPA
│   └── src/
│       ├── pages/    # Сторінки
│       ├── components/
│       ├── store/    # Zustand
│       └── services/ # API клієнт
└── telegram-bot/     # Grammy бот
```

## Запуск

### Backend
```bash
cd backend
cp .env.example .env  # заповнити змінні
npm install
npm run migrate       # застосувати міграції БД
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Telegram Bot
```bash
cd telegram-bot
npm install
npm run dev
```

## Змінні середовища (backend/.env)

| Змінна | Опис |
|--------|------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для access token |
| `JWT_REFRESH_SECRET` | Секрет для refresh token |
| `TELEGRAM_BOT_TOKEN` | Токен бота від @BotFather |
| `FRONTEND_URL` | URL фронтенду |

## Фази розробки

- [x] Фаза 1: БД схема, Auth, базовий API, Telegram бот
- [ ] Фаза 2: CRUD осіб/зв'язків, повний бот
- [ ] Фаза 3: React Flow граф дерева
- [ ] Фаза 4: Система ролей та підтвердження
- [ ] Фаза 5: Медіа, дошка пам'яті, чат
- [ ] Фаза 6: Часова шкала, пошук, Socket.io
- [ ] Фаза 7: Імпорт/Експорт GEDCOM/PDF/PNG
- [ ] Фаза 8: Деплой на Railway
