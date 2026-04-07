# 🚀 FreelanceKG - Руководство по развёртыванию

> Фриланс-платформа для Кыргызстана с эскроу-системой

## 📋 Содержание

- [Требования](#-требования)
- [Быстрый старт](#-быстрый-старт)
- [Ручная установка](#-ручная-установка)
- [Структура проекта](#-структура-проекта)
- [API документация](#-api-документация)
- [Тестовые аккаунты](#-тестовые-аккаунты)
- [Конфигурация](#️-конфигурация)
- [Частые проблемы](#-частые-проблемы)
- [Продакшн развёртывание](#-продакшн-развёртывание)

---

## 📦 Требования

| Компонент | Минимальная версия | Рекомендуемая |
|-----------|-------------------|---------------|
| Node.js | 18.0+ | 20 LTS |
| PostgreSQL | 14+ | 15+ |
| Redis | 6+ | 7+ |
| npm | 9+ | 10+ |

### Поддерживаемые ОС

- ✅ macOS (Homebrew)
- ✅ Ubuntu / Debian / Linux Mint
- ✅ Arch Linux / Manjaro
- ✅ Fedora / CentOS / RHEL
- ⚠️ Windows (через WSL2)

---

## ⚡ Быстрый старт

### Один скрипт — полная установка:

```bash
# 1. Клонируйте репозиторий
git clone <repository-url>
cd freelancekg

# 2. Сделайте скрипты исполняемыми
chmod +x install.sh start.sh stop.sh

# 3. Запустите установку (установит Node.js, PostgreSQL, Redis)
./install.sh

# 4. Запустите проект
./start.sh
```

После запуска:
- 🌐 **Фронтенд:** http://localhost:5173
- 🔧 **Бэкенд API:** http://localhost:3001
- 📊 **Prisma Studio:** `cd server && npx prisma studio`

---

## 🔧 Ручная установка

Если автоматический скрипт не подходит:

### 1. Установите зависимости

**macOS:**
```bash
brew install node@20 postgresql@14 redis
brew services start postgresql@14
brew services start redis
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib redis-server
sudo systemctl start postgresql redis-server
```

**Arch Linux:**
```bash
sudo pacman -S nodejs npm postgresql redis
sudo systemctl start postgresql redis
```

### 2. Создайте базу данных

```bash
# macOS
createdb freelancekg

# Linux
sudo -u postgres createdb freelancekg
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

### 3. Настройте проект

```bash
# Установите npm пакеты
npm install
cd server && npm install && cd ..

# Создайте .env файл
cp server/.env.example server/.env
# Отредактируйте server/.env - укажите правильный DATABASE_URL

# Сгенерируйте Prisma Client
cd server
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
cd ..
```

### 4. Запустите

```bash
# Терминал 1 - Бэкенд
cd server && npm run dev

# Терминал 2 - Фронтенд
npm run dev
```

---

## 📁 Структура проекта

```
freelancekg/
├── 📄 install.sh            # Скрипт установки
├── 📄 start.sh              # Скрипт запуска
├── 📄 stop.sh               # Скрипт остановки
├── 📄 package.json          # Фронтенд зависимости
├── 📄 vite.config.ts        # Vite конфигурация
├── 📄 tailwind.config.js    # Tailwind CSS
│
├── 📂 src/                  # Фронтенд (React + TypeScript)
│   ├── 📂 components/       # UI компоненты
│   ├── 📂 pages/            # Страницы приложения
│   ├── 📂 context/          # React Context (Auth, Theme)
│   ├── 📂 services/         # API сервисы
│   ├── 📂 data/             # Типы и интерфейсы
│   └── 📄 App.tsx           # Главный компонент
│
├── 📂 server/               # Бэкенд (Express + TypeScript)
│   ├── 📄 package.json      # Серверные зависимости
│   ├── 📄 .env              # Переменные окружения
│   ├── 📂 prisma/
│   │   └── 📄 schema.prisma # Модели базы данных
│   ├── 📂 src/
│   │   ├── 📄 index.ts      # Express сервер + Socket.io
│   │   ├── 📄 seed.ts       # Seed данные
│   │   ├── 📂 routes/       # API роуты
│   │   ├── 📂 middleware/   # Middleware (auth, etc.)
│   │   └── 📂 lib/          # Утилиты (jwt, bcrypt, prisma)
│   └── 📂 uploads/          # Загруженные файлы
│
└── 📂 logs/                 # Логи серверов
```

---

## 📡 API документация

### Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/auth/logout` | Выход |

**Пример регистрации:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "Имя Пользователя",
    "role": "CLIENT"
  }'
```

### Фрилансеры

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/freelancers` | Список фрилансеров |
| GET | `/api/freelancers/:id` | Профиль фрилансера |
| PUT | `/api/freelancers/profile` | Обновить свой профиль |

**Параметры поиска:**
- `category` - фильтр по категории
- `search` - поиск по имени/навыкам
- `minRating` - минимальный рейтинг
- `maxPrice` - максимальная цена

### Заказы

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/orders` | Мои заказы |
| GET | `/api/orders/available` | Доступные заказы (для фрилансеров) |
| GET | `/api/orders/:id` | Детали заказа |
| POST | `/api/orders` | Создать заказ |
| POST | `/api/orders/:id/accept` | Взять заказ |
| POST | `/api/orders/:id/submit` | Сдать работу |
| POST | `/api/orders/:id/approve` | Принять работу |
| POST | `/api/orders/:id/cancel` | Отменить заказ |

### Сообщения

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/messages/:orderId` | История сообщений |
| POST | `/api/messages` | Отправить сообщение |

### Socket.io Events

```javascript
// Подключение
const socket = io('http://localhost:3001');

// События
socket.emit('join-order', orderId);
socket.emit('send-message', { orderId, content, senderId });
socket.emit('typing', { orderId, userId });

socket.on('new-message', (message) => { ... });
socket.on('user-typing', (data) => { ... });
```

---

## 👤 Тестовые аккаунты

После запуска `npx prisma db seed` создаются:

| Роль | Email | Пароль |
|------|-------|--------|
| 👤 Заказчик | `client@test.kg` | `password123` |
| 👨‍💻 Фрилансер | `aibek@test.kg` | `password123` |
| 👨‍💻 Фрилансер | `aigerim@test.kg` | `password123` |
| 👨‍💻 Фрилансер | `nurlan@test.kg` | `password123` |
| 👑 Админ | `admin@test.kg` | `password123` |

---

## ⚙️ Конфигурация

### server/.env

```env
# База данных PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/freelancekg"

# JWT настройки
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="7d"

# Сервер
PORT=3001
NODE_ENV=development

# Redis (опционально)
REDIS_URL="redis://localhost:6379"

# Загрузка файлов
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760
```

### DATABASE_URL форматы

```env
# macOS (без пароля)
DATABASE_URL="postgresql://username@localhost:5432/freelancekg"

# Linux (с паролем)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/freelancekg"

# Docker
DATABASE_URL="postgresql://postgres:postgres@db:5432/freelancekg"
```

---

## ❓ Частые проблемы

### 1. PostgreSQL не запускается

**macOS:**
```bash
brew services restart postgresql@14
# или
pg_ctl -D /usr/local/var/postgres start
```

**Linux:**
```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

### 2. Ошибка подключения к БД

```bash
# Проверьте что PostgreSQL запущен
pg_isready

# Проверьте что база существует
psql -l | grep freelancekg

# Создайте базу если нет
createdb freelancekg
```

### 3. Порт уже занят

```bash
# Найти процесс на порту
lsof -i :3001
lsof -i :5173

# Убить процесс
kill -9 <PID>

# Или используйте stop.sh
./stop.sh
```

### 4. Prisma ошибки

```bash
cd server

# Пересоздать клиент
npx prisma generate

# Сбросить и пересоздать БД
npx prisma migrate reset

# Применить миграции
npx prisma migrate dev
```

### 5. Ошибка bcrypt на M1/M2 Mac

```bash
cd server
npm rebuild bcryptjs
```

### 6. Redis не работает

Redis опционален. Проект работает без него, просто без кэширования.

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis-server
```

---

## 🏭 Продакшн развёртывание

### С Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: freelancekg
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  redis:
    image: redis:7-alpine
    
  backend:
    build: ./server
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/freelancekg
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
    ports:
      - "3001:3001"
      
  frontend:
    build: .
    ports:
      - "80:80"

volumes:
  postgres_data:
```

### С PM2 (без Docker)

```bash
# Установите PM2
npm install -g pm2

# Запустите бэкенд
cd server
npm run build
pm2 start dist/index.js --name freelancekg-api

# Соберите фронтенд
cd ..
npm run build

# Настройте Nginx для раздачи dist/
```

### Nginx конфиг

```nginx
server {
    listen 80;
    server_name freelance.kg;
    
    # Фронтенд
    location / {
        root /var/www/freelancekg/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
    
    # Socket.io
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `cat logs/backend.log`
2. Проверьте статус сервисов: `pg_isready`, `redis-cli ping`
3. Пересоздайте БД: `cd server && npx prisma migrate reset`

---

## 📄 Лицензия

MIT © 2025 FreelanceKG

---

**Сделано с ❤️ в Кыргызстане 🇰🇬**
