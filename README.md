<div align="center">

# BUBBLE BATTLE

**Мультяшная онлайн-выживалка в стиле .io: королевская битва на Next.js**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![socket.io](https://img.shields.io/badge/socket.io-4-white?logo=socketdotio&logoColor=black)](https://socket.io)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**Русский** · [English](./README.en.md)

</div>

---

## О проекте

Онлайн-игра «королевская битва» (по мотивам surviv.io): игроки сходятся на карте, стреляют друг в друга, собирают лут из ящиков и стараются остаться последним выжившим, пока шторм сужает арену. Полностью авторитетный сервер на socket.io, рендер на HTML5 Canvas, таблица лидеров в SQLite через Prisma.

- **Только реальные игроки** — ботов нет, для матча нужно минимум 2 человека
- **Раунды автоматические**: лобби → отсчёт 5 секунд → бой → результаты → новое лобби
- **Шторм (зона)** сужается фазами и наносит всё больший урон вне безопасного круга
- **Лут**: ящики с автоматом, дробовиком, снайперкой или аптечкой
- **Кроссплатформенно**: WASD + мышь на компьютере, два виртуальных стика на телефоне

## Как играть

| Действие | Компьютер | Телефон |
| --- | --- | --- |
| Движение | WASD или стрелки | левый стик |
| Прицел | мышь | правый стик |
| Стрельба | ЛКМ (удерживать) | наклон правого стика |

Ящик открывается касанием. Победа — остаться последним живым.

## Запуск

Понадобятся **Node.js 20.9+** и npm.

```bash
# 1. Клонировать репозиторий и установить зависимости
git clone https://github.com/Mid1ddy/nextjs-boilerplate.git
cd nextjs-boilerplate
npm install

# 2. Создать .env (или скопировать .env.example)
#    Windows (PowerShell): Copy-Item .env.example .env
cp .env.example .env

# 3. Создать базу данных (SQLite)
npm run db:push

# 4. Запустить игру (Next.js + socket.io в одном процессе)
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000), введи ник и нажми «Играть». Для старта раунда нужно минимум 2 игрока — открой вторую вкладку или позови друга (сервер доступен по IP твоей машины в локальной сети).

Продакшен-сборка: `npm run build`, затем `npm start`.

## Скрипты

| Команда | Описание |
| --- | --- |
| `npm run dev` | Сервер разработки (Next.js + socket.io) |
| `npm run build` | Продакшен-сборка Next.js |
| `npm start` | Запуск продакшен-версии |
| `npm run lint` | Проверка кода ESLint |
| `npm run db:push` | Применить схему Prisma к SQLite |

## Как устроен мультиплеер

- `server/index.ts` — custom server: HTTP-сервер держит и Next.js, и WebSocket (socket.io, путь `/socket.io`)
- `lib/game/engine.ts` — авторитетная симуляция: мир, движение, коллизии, пули, ящики, зоны шторма, фазы раунда (50 Гц)
- `lib/game/wiring.ts` — общая привязка socket.io: события `join` / `input` / `state` и рассылка снапшотов 20 раз в секунду
- `components/game/GameCanvas.tsx` — клиент: canvas-рендер, ввод с клавиатуры/мыши/тача, HUD
- `lib/db.ts` + `prisma/schema.prisma` — таблица `Player`: победы, убийства, раунды. После каждого раунда результаты сохраняются на сервере, меню читает их через API-роут `/api/leaderboard`

## Структура проекта

```text
nextjs-boilerplate/
├── server/
│   └── index.ts          # custom server: Next.js + socket.io
├── app/
│   ├── favicon.ico
│   ├── globals.css       # глобальные стили (Tailwind CSS 4)
│   ├── layout.tsx        # корневой layout: шрифты и метаданные
│   ├── page.tsx          # меню: ник, таблица лидеров, вход в игру
│   └── api/
│       └── leaderboard/  # GET — топ-10 игроков
├── components/
│   └── game/
│       └── GameCanvas.tsx # игровой клиент: canvas, ввод, HUD
├── lib/
│   ├── db.ts             # Prisma Client
│   └── game/
│       ├── shared.ts     # общие константы и типы
│       ├── engine.ts     # игровая логика (сервер)
│       ├── wiring.ts     # привязка socket.io
│       └── socket.ts     # фабрика сокета (клиент)
├── prisma/
│   └── schema.prisma     # модель Player (SQLite)
├── AGENTS.md             # правила для AI-агентов
├── CLAUDE.md             # правила для Claude Code
└── package.json
```

## Деплой

Игра использует WebSocket и постоянный Node-процесс, поэтому классический serverless-хостинг (Vercel Functions) не подойдёт. Варианты: **Railway**, **Render**, **Fly.io** или свой VPS — команды `npm run build` + `npm start`, порт задаётся переменной `PORT`.

## Технологии

| Слой | Технология |
| --- | --- |
| Фреймворк | Next.js 16 (App Router), React 19, TypeScript 5 |
| Реалтайм | socket.io 4 (custom server) |
| Рендер | HTML5 Canvas 2D |
| Стили | Tailwind CSS 4 |
| База | SQLite + Prisma 6 |

## Лицензия

Проект распространяется по лицензии [MIT](./LICENSE).
