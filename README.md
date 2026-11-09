<div align="center">

# Next.js Boilerplate

**Современный стартовый шаблон веб-приложения: Next.js 16, React 19, TypeScript, Tailwind CSS 4**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**Русский** · [English](./README.en.md)

</div>

---

## О проекте

Минимальный, но полностью настроенный стартовый шаблон для веб-приложений на Next.js с App Router. Проект создан через `create-next-app` и работает «из коробки»: типизация на TypeScript, утилитарные стили на Tailwind CSS 4, оптимизированные шрифты Geist и аккуратная структура папок для быстрого старта новых проектов.

## Возможности

- **App Router** — современный роутинг Next.js с серверными компонентами
- **TypeScript 5** — статическая типизация из коробки
- **Tailwind CSS 4** — утилитарные стили через PostCSS-плагин, без отдельного конфига
- **Шрифты Geist** — автоматическая оптимизация через `next/font`
- **ESLint 9** — flat config с правилами `eslint-config-next`
- **Тёмная тема** — базовые стили и цветовые переменные уже настроены

## Быстрый старт

Понадобятся **Node.js 20.9+** и npm.

```bash
# 1. Клонировать репозиторий
git clone https://github.com/Mid1ddy/nextjs-boilerplate.git
cd nextjs-boilerplate

# 2. Установить зависимости
npm install

# 3. Запустить сервер разработки
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000) в браузере. Страница автоматически обновляется при редактировании `app/page.tsx`.

## Скрипты

| Команда | Описание |
| --- | --- |
| `npm run dev` | Сервер разработки на `localhost:3000` |
| `npm run build` | Продакшен-сборка |
| `npm run start` | Запуск продакшен-сборки |
| `npm run lint` | Проверка кода ESLint |

## Структура проекта

```text
nextjs-boilerplate/
├── app/
│   ├── favicon.ico       # иконка сайта
│   ├── globals.css       # глобальные стили (Tailwind CSS 4)
│   ├── layout.tsx        # корневой layout: шрифты и метаданные
│   └── page.tsx          # главная страница
├── public/               # статические файлы (svg-иконки)
├── AGENTS.md             # правила для AI-агентов
├── CLAUDE.md             # правила для Claude Code
├── eslint.config.mjs     # конфигурация ESLint 9 (flat config)
├── next.config.ts        # конфигурация Next.js
├── postcss.config.mjs    # конфигурация PostCSS (плагин Tailwind)
├── package.json          # зависимости и скрипты
└── tsconfig.json         # конфигурация TypeScript
```

## Для AI-ассистентов

Файлы `AGENTS.md` и `CLAUDE.md` содержат правила для AI-редакторов кода (Cursor, Copilot, Claude Code и других): Next.js 16 отличается от предыдущих версий, поэтому перед написанием кода ассистенту предлагается сверяться с документацией в `node_modules/next/dist/docs/`.

## Деплой

Проще всего развернуть приложение на [Vercel](https://vercel.com/new) — платформе от создателей Next.js:

1. Импортируй репозиторий в Vercel
2. Настройки сборки определятся автоматически
3. Нажми **Deploy**

Подробности — в [документации по деплою Next.js](https://nextjs.org/docs/app/getting-started/deploying).

## Лицензия

Проект распространяется по лицензии [MIT](./LICENSE).
