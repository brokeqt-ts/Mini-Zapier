# Mini-Zapier

**Визуальный конструктор автоматизации** — создавайте сценарии, соединяя триггеры и действия в графическом редакторе, без кода.

**Visual workflow automation builder** — create automations by connecting triggers and actions in a drag-and-drop editor, no code required.

---

<p align="center">
  <img alt="Stack" src="https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white"/>
  <img alt="Stack" src="https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black"/>
  <img alt="Stack" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white"/>
  <img alt="Stack" src="https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white"/>
  <img alt="Stack" src="https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white"/>
  <img alt="i18n" src="https://img.shields.io/badge/i18n-RU%20%2F%20EN-brightgreen?style=flat"/>
</p>

---

## 🇷🇺 Русский

- [Описание](#описание)
- [Стек технологий](#стек-технологий)
- [Быстрый старт](#быстрый-старт)
- [Обучающий гайд](#обучающий-гайд)

## 🇬🇧 English

- [Description](#description)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Tutorial Guide](#tutorial-guide)

---

# 🇷🇺 Русский

## Описание

Mini-Zapier — это self-hosted платформа автоматизации, вдохновлённая Zapier и n8n. Вы рисуете граф из **триггеров** и **действий**, сохраняете его, активируете — и сценарий начинает работать автоматически.

### Доступные триггеры
| Триггер | Описание |
|---------|----------|
| **Webhook** | Запускает сценарий при входящем HTTP-запросе |
| **Cron** | Запускает по расписанию (каждый час, каждый день и т.д.) |
| **Email (IMAP)** | Запускает при получении нового письма на почту |

### Доступные действия
| Действие | Описание |
|----------|----------|
| **HTTP-запрос** | Отправляет GET/POST/PUT/DELETE на любой URL |
| **Отправить email** | Отправляет письмо через ваш SMTP |
| **Telegram** | Отправляет сообщение в Telegram-бот |
| **SQL-запрос** | Выполняет SELECT/INSERT/UPDATE в PostgreSQL |
| **Трансформация данных** | Преобразует JSON: маппинг полей, функции ($sum, $count и др.) |

### Ключевые возможности
- Визуальный редактор на базе React Flow
- Передача данных между узлами через переменные `{{node.field}}`
- Условные рёбра с выражениями (выполнить только если...)
- История запусков с детальными логами каждого узла
- Интерфейс на **русском и английском** (переключатель в шапке)
- Несколько email-аккаунтов на один профиль

---

## Стек технологий

### Бэкенд
- **NestJS** — основной фреймворк
- **Prisma** — ORM для PostgreSQL
- **BullMQ** — очереди задач (Redis)
- **Passport / JWT** — аутентификация
- **Nodemailer** — отправка писем
- **node-imap** — получение писем
- **node-cron** — планировщик

### Фронтенд
- **React 18** + **TypeScript**
- **Vite** — сборщик
- **React Flow (@xyflow/react)** — визуальный редактор графов
- **Zustand** — управление состоянием
- **Axios** — HTTP-клиент
- **react-hot-toast** — уведомления

### Инфраструктура
- **PostgreSQL** — основная БД
- **Redis** — брокер очередей BullMQ

---

## Быстрый старт

### Требования
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### 1. Клонировать репозиторий
```bash
git clone https://github.com/your-username/mini-zapier.git
cd mini-zapier
```

### 2. Установить зависимости
```bash
# Корень (shared пакет)
npm install

# Бэкенд
cd backend && npm install

# Фронтенд
cd ../frontend && npm install
```

### 3. Настроить переменные окружения

**backend/.env**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/mini_zapier"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secret_key_here
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**frontend/.env**
```env
VITE_API_URL=http://localhost:3000
```

### 4. Применить миграции БД
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 5. Запустить
```bash
# В одном терминале — бэкенд
cd backend && npm run start:dev

# В другом терминале — фронтенд
cd frontend && npm run dev
```

Приложение будет доступно на `http://localhost:5173`

---

## Обучающий гайд

> Полное пошаговое освоение всех функций Mini-Zapier.

### Шаг 1 — Регистрация и вход

1. Откройте приложение, вы попадёте на страницу входа.
2. Нажмите **«Зарегистрироваться»** и создайте аккаунт (имя, email, пароль).
3. После регистрации вы автоматически войдёте в систему.

---

### Шаг 2 — Дашборд

На дашборде отображается:
- **Статистика** — количество сценариев, активных, запусков, процент успешных.
- **Список сценариев** — все ваши автоматизации с кнопками редактирования и удаления.
- **Последние запуски** — хронология выполнений.

Чтобы создать первый сценарий, введите название в поле и нажмите **«Создать»**.

---

### Шаг 3 — Редактор сценариев

После нажатия «Редактировать» вы попадёте в редактор. Он состоит из:

- **Левая панель (Node Palette)** — список доступных триггеров и действий.
- **Центральная область (Canvas)** — рабочее поле, куда вы перетаскиваете узлы.
- **Правая панель (Config Panel)** — настройки выбранного узла или ребра.

#### Как добавить узел
Перетащите нужный тип (например, «Webhook») из левой панели на холст.

#### Как соединить узлы
Наведите курсор на нижний порт узла (маленький кружок) и потяните к верхнему порту следующего узла. Образуется **ребро** — стрелка между узлами.

#### Как переименовать узел
Дважды кликните по названию узла — поле станет редактируемым.

---

### Шаг 4 — Настройка триггера Webhook

1. Перетащите **Webhook** на холст и кликните по нему.
2. В правой панели появится **URL вебхука** — скопируйте его.
3. Сохраните сценарий (кнопка **«Сохранить»**) и активируйте (**«Активировать»**).
4. Отправьте POST-запрос на этот URL — сценарий запустится.

> Данные из тела запроса доступны в последующих узлах как переменные.

---

### Шаг 5 — Настройка триггера Cron

1. Перетащите **Расписание (Cron)** на холст.
2. В настройках выберите пресет (каждый час, каждый день и т.д.) или задайте cron-выражение вручную.
3. Выберите часовой пояс.
4. Активируйте сценарий — он будет запускаться по расписанию автоматически.

---

### Шаг 6 — Настройка триггера Email

1. Сначала добавьте email-аккаунт в **Настройках** (иконка шестерёнки).
2. В настройках укажите SMTP (для отправки) и IMAP (для получения) данные.
3. Вернитесь в редактор, перетащите **Email-триггер**.
4. Выберите сохранённый аккаунт — сценарий запустится при получении нового письма.

---

### Шаг 7 — Действие «HTTP-запрос»

1. Добавьте узел **HTTP-запрос** и соедините его с триггером.
2. Укажите метод (GET, POST, PUT, DELETE, PATCH) и URL.
3. Можно добавить **заголовки** и **тело** запроса.
4. В URL и теле используйте переменные из предыдущих узлов: `{{triggerNode.body.email}}`

---

### Шаг 8 — Действие «Отправить email»

1. Добавьте узел **Email** после триггера.
2. Выберите **«Использовать сохранённый аккаунт»** или введите SMTP вручную.
3. Заполните **Кому**, **Тема**, **Текст** — можно использовать переменные `{{...}}`.
4. Используйте **редактор шаблона** (кнопка `⟨/⟩`) для вставки переменных из списка.

---

### Шаг 9 — Действие «Telegram»

1. Перейдите в **Настройки** → раздел Telegram.
2. Нажмите ссылку на вашего бота и нажмите `/start` в чате — это привяжет ваш аккаунт.
3. В узле Telegram введите текст сообщения с переменными.

---

### Шаг 10 — Действие «SQL-запрос»

1. В узле **SQL** укажите строку подключения к PostgreSQL.
2. Выберите режим: **SELECT** (чтение), **INSERT/UPDATE** (запись) или **Произвольный SQL**.
3. В SELECT-режиме конструктор поможет выбрать таблицу и условия без написания SQL вручную.

---

### Шаг 11 — Действие «Трансформация данных»

Этот узел преобразует JSON-данные из предыдущих шагов:

1. Укажите **источник** — JSONPath к массиву или объекту (`$.items`).
2. Добавьте **маппинг полей**: выходное поле → входное выражение.
3. Применяйте **функции**: `$count`, `$sum`, `$number`, `$string`, `$uppercase`, `$lowercase`.
4. Результат доступен следующим узлам как `{{transformNode.result}}`.

---

### Шаг 12 — Переменные между узлами

Любые данные, выводимые узлом, доступны в последующих узлах через синтаксис:
```
{{имяУзла.поле.вложенноеПоле}}
```

Чтобы вставить переменную, нажмите кнопку **`⟨/⟩ Вставить переменную`** — откроется визуальный выбор всех доступных полей.

---

### Шаг 13 — Условные рёбра

Кликните по стрелке между узлами. В панели можно задать **выражение-условие** — следующий узел выполнится только если условие истинно.

Пример:
```
{{httpNode.status}} === 200
```

---

### Шаг 14 — История запусков

Нажмите **«История»** в редакторе. Вы увидите:
- Список всех запусков с временем и статусом.
- Кликнув на запуск — детальные логи каждого узла: входные данные, выходные данные, ошибки, время выполнения.

---

### Шаг 15 — Тестовый запуск

Кнопка **«Тест»** в редакторе запускает сценарий немедленно (вручную), не дожидаясь триггера. Удобно при разработке.

---

# 🇬🇧 English

## Description

Mini-Zapier is a self-hosted automation platform inspired by Zapier and n8n. You draw a graph of **triggers** and **actions**, save it, activate it — and the workflow runs automatically.

### Available Triggers
| Trigger | Description |
|---------|-------------|
| **Webhook** | Fires when an incoming HTTP request is received |
| **Cron** | Fires on a schedule (every hour, every day, etc.) |
| **Email (IMAP)** | Fires when a new email arrives in your inbox |

### Available Actions
| Action | Description |
|--------|-------------|
| **HTTP Request** | Sends GET/POST/PUT/DELETE to any URL |
| **Send Email** | Sends an email via your SMTP account |
| **Telegram** | Sends a message to a Telegram bot |
| **SQL Query** | Runs SELECT/INSERT/UPDATE against PostgreSQL |
| **Data Transform** | Transforms JSON: field mapping, functions ($sum, $count, etc.) |

### Key Features
- Visual editor powered by React Flow
- Data passing between nodes via `{{node.field}}` variables
- Conditional edges with expressions (run only if...)
- Execution history with per-node detailed logs
- UI in **Russian and English** (toggle in the header)
- Multiple email accounts per user profile

---

## Tech Stack

### Backend
- **NestJS** — core framework
- **Prisma** — ORM for PostgreSQL
- **BullMQ** — job queues (Redis)
- **Passport / JWT** — authentication
- **Nodemailer** — email sending
- **node-imap** — email receiving
- **node-cron** — scheduler

### Frontend
- **React 18** + **TypeScript**
- **Vite** — build tool
- **React Flow (@xyflow/react)** — visual graph editor
- **Zustand** — state management
- **Axios** — HTTP client
- **react-hot-toast** — notifications

### Infrastructure
- **PostgreSQL** — primary database
- **Redis** — BullMQ message broker

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### 1. Clone the repository
```bash
git clone https://github.com/your-username/mini-zapier.git
cd mini-zapier
```

### 2. Install dependencies
```bash
# Root (shared package)
npm install

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Configure environment variables

**backend/.env**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/mini_zapier"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secret_key_here
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**frontend/.env**
```env
VITE_API_URL=http://localhost:3000
```

### 4. Apply DB migrations
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 5. Run
```bash
# Terminal 1 — backend
cd backend && npm run start:dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

App will be available at `http://localhost:5173`

---

## Tutorial Guide

> A complete step-by-step walkthrough of all Mini-Zapier features.

### Step 1 — Register & Log In

1. Open the app — you'll land on the login page.
2. Click **"Register"** and create an account (name, email, password).
3. After registration you are logged in automatically.

---

### Step 2 — Dashboard

The dashboard shows:
- **Stats** — total workflows, active, executions, success rate.
- **Workflow list** — all your automations with edit and delete buttons.
- **Recent executions** — a chronological run history.

To create your first workflow, type a name in the input and click **"Create"**.

---

### Step 3 — Workflow Editor

Clicking "Edit" opens the editor, which consists of:

- **Left panel (Node Palette)** — list of available triggers and actions.
- **Center area (Canvas)** — the workspace where you drag nodes.
- **Right panel (Config Panel)** — settings for the selected node or edge.

#### Adding a node
Drag any type (e.g. "Webhook") from the left palette onto the canvas.

#### Connecting nodes
Hover over the bottom port of a node (small circle) and drag to the top port of the next node. This creates an **edge** — an arrow between nodes.

#### Renaming a node
Double-click the node label — it becomes editable inline.

---

### Step 4 — Webhook Trigger

1. Drag **Webhook** onto the canvas and click it.
2. The right panel shows the **webhook URL** — copy it.
3. Save the workflow (**"Save"**) and activate it (**"Activate"**).
4. Send a POST request to that URL — the workflow fires.

> Request body data is available in downstream nodes as variables.

---

### Step 5 — Cron Trigger

1. Drag **Schedule (Cron)** onto the canvas.
2. In settings, pick a preset (every hour, every day, etc.) or type a cron expression manually.
3. Choose a timezone.
4. Activate the workflow — it will run on schedule automatically.

---

### Step 6 — Email Trigger

1. First add an email account in **Settings** (gear icon in the header).
2. Enter SMTP (for sending) and IMAP (for receiving) credentials.
3. Go back to the editor and drag **Email Trigger**.
4. Select the saved account — the workflow will fire on every new incoming email.

---

### Step 7 — HTTP Request Action

1. Add an **HTTP Request** node and connect it to a trigger.
2. Set the method (GET, POST, PUT, DELETE, PATCH) and URL.
3. Optionally add **headers** and a **request body**.
4. Use variables from upstream nodes in the URL or body: `{{triggerNode.body.email}}`

---

### Step 8 — Send Email Action

1. Add an **Email** node after a trigger.
2. Choose **"Use saved account"** or enter SMTP credentials manually.
3. Fill in **To**, **Subject**, **Body** — variables `{{...}}` are supported everywhere.
4. Use the **template editor** (the `⟨/⟩` button) for a visual variable picker.

---

### Step 9 — Telegram Action

1. Go to **Settings** → Telegram section.
2. Click the link to your bot and send `/start` in the chat — this links your account.
3. In the Telegram node, write the message text with variables.

---

### Step 10 — SQL Query Action

1. In the **SQL** node, enter your PostgreSQL connection string.
2. Choose a mode: **SELECT** (read), **INSERT/UPDATE** (write), or **Raw SQL**.
3. In SELECT mode, a visual builder lets you pick a table and conditions without writing SQL manually.

---

### Step 11 — Data Transform Action

This node transforms JSON data from upstream steps:

1. Set a **source** — a JSONPath to an array or object (`$.items`).
2. Add **field mappings**: output field → input expression.
3. Apply **functions**: `$count`, `$sum`, `$number`, `$string`, `$uppercase`, `$lowercase`.
4. The result is available to downstream nodes as `{{transformNode.result}}`.

---

### Step 12 — Variables Between Nodes

Any data output by a node is available in downstream nodes via:
```
{{nodeName.field.nestedField}}
```

Click the **`⟨/⟩ Insert variable`** button to open a visual picker showing all available fields from upstream nodes.

---

### Step 13 — Conditional Edges

Click the arrow between two nodes. In the panel you can set a **condition expression** — the downstream node runs only if the condition is truthy.

Example:
```
{{httpNode.status}} === 200
```

---

### Step 14 — Execution History

Click **"History"** in the editor toolbar. You'll see:
- A list of all runs with timestamps and status.
- Clicking a run shows per-node detailed logs: input data, output data, errors, duration.

---

### Step 15 — Test Run

The **"Test"** button in the editor triggers the workflow immediately (manually), without waiting for the trigger event. Useful during development.

---

## License

MIT
