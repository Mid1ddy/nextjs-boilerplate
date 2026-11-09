<div align="center">

# Next.js Boilerplate

**A modern web app starter: Next.js 16, React 19, TypeScript, Tailwind CSS 4**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

[Русский](./README.md) · **English**

</div>

---

## About

A minimal yet fully configured starter template for Next.js web applications with the App Router. The project was bootstrapped with `create-next-app` and works out of the box: TypeScript typing, Tailwind CSS 4 utility styles via a PostCSS plugin, optimized Geist fonts, and a clean folder structure for quickly starting new projects.

## Features

- **App Router** — modern Next.js routing with server components
- **TypeScript 5** — static typing out of the box
- **Tailwind CSS 4** — utility-first styling through a PostCSS plugin, no extra config
- **Geist fonts** — automatic optimization via `next/font`
- **ESLint 9** — flat config with `eslint-config-next` rules
- **Dark theme** — base styles and color variables are already set up

## Getting Started

You will need **Node.js 20.9+** and npm.

```bash
# 1. Clone the repository
git clone https://github.com/Mid1ddy/nextjs-boilerplate.git
cd nextjs-boilerplate

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The page auto-updates as you edit `app/page.tsx`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server on `localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint checks |

## Project Structure

```text
nextjs-boilerplate/
├── app/
│   ├── favicon.ico       # site favicon
│   ├── globals.css       # global styles (Tailwind CSS 4)
│   ├── layout.tsx        # root layout: fonts and metadata
│   └── page.tsx          # home page
├── public/               # static assets (svg icons)
├── AGENTS.md             # rules for AI agents
├── CLAUDE.md             # rules for Claude Code
├── eslint.config.mjs     # ESLint 9 configuration (flat config)
├── next.config.ts        # Next.js configuration
├── postcss.config.mjs    # PostCSS configuration (Tailwind plugin)
├── package.json          # dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## For AI Assistants

The `AGENTS.md` and `CLAUDE.md` files contain rules for AI coding assistants (Cursor, Copilot, Claude Code, etc.): Next.js 16 differs from previous versions, so assistants are asked to consult the documentation in `node_modules/next/dist/docs/` before writing code.

## Deployment

The easiest way to deploy the app is on [Vercel](https://vercel.com/new), the platform from the creators of Next.js:

1. Import the repository into Vercel
2. Build settings are detected automatically
3. Click **Deploy**

For more details, see the [Next.js deployment documentation](https://nextjs.org/docs/app/getting-started/deploying).

## License

This project is licensed under the [MIT License](./LICENSE).
