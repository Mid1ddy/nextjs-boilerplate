<div align="center">

# BUBBLE BATTLE

**A cartoon online .io-style battle royale built with Next.js**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![socket.io](https://img.shields.io/badge/socket.io-4-white?logo=socketdotio&logoColor=black)](https://socket.io)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

[Русский](./README.md) · **English**

</div>

---

## About

An online battle royale game (inspired by surviv.io): players meet on a map, shoot each other, grab loot from crates and try to stay the last one standing while the storm shrinks the arena. Fully authoritative socket.io server, HTML5 Canvas rendering, and a SQLite leaderboard powered by Prisma.

- **Real players only** — no bots, a match needs at least 2 humans
- **Automatic rounds**: lobby → 5-second countdown → fight → results → new lobby
- **Storm (zone)** shrinks in phases and deals growing damage outside the safe circle
- **Loot**: crates with an SMG, shotgun, sniper rifle or a medkit
- **Cross-platform**: WASD + mouse on desktop, two virtual sticks on mobile

## How to Play

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD or arrows | left stick |
| Aim | mouse | right stick |
| Shoot | LMB (hold) | tilt the right stick |

Touch a crate to open it. Be the last player alive to win.

## Getting Started

You will need **Node.js 20.9+** and npm.

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/Mid1ddy/nextjs-boilerplate.git
cd nextjs-boilerplate
npm install

# 2. Create .env (or copy .env.example)
cp .env.example .env

# 3. Create the database (SQLite)
npm run db:push

# 4. Run the game (Next.js + socket.io in one process)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a nickname and press Play. A round needs at least 2 players — open a second tab or invite a friend (the server is reachable by your machine's IP on the LAN).

Production build: `npm run build`, then `npm start`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server (Next.js + socket.io) |
| `npm run build` | Production build |
| `npm start` | Run the production version |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Apply the Prisma schema to SQLite |

## How the Multiplayer Works

- `server/index.ts` — custom server: one HTTP server hosts both Next.js and WebSocket (socket.io, path `/socket.io`)
- `lib/game/engine.ts` — authoritative simulation: world, movement, collisions, bullets, crates, storm zones and round phases (50 Hz)
- `lib/game/wiring.ts` — shared socket.io wiring: `join` / `input` / `state` events and snapshot broadcasts 20 times per second
- `components/game/GameCanvas.tsx` — client: canvas rendering, keyboard/mouse/touch input, HUD
- `lib/db.ts` + `prisma/schema.prisma` — the `Player` table: wins, kills, rounds. Round results are saved on the server, and the menu reads them via the `/api/leaderboard` API route

## Project Structure

```text
nextjs-boilerplate/
├── server/
│   └── index.ts          # custom server: Next.js + socket.io
├── app/
│   ├── favicon.ico
│   ├── globals.css       # global styles (Tailwind CSS 4)
│   ├── layout.tsx        # root layout: fonts and metadata
│   ├── page.tsx          # menu: nickname, leaderboard, play
│   └── api/
│       └── leaderboard/  # GET — top-10 players
├── components/
│   └── game/
│       └── GameCanvas.tsx # game client: canvas, input, HUD
├── lib/
│   ├── db.ts             # Prisma Client
│   └── game/
│       ├── shared.ts     # shared constants and types
│       ├── engine.ts     # game logic (server)
│       ├── wiring.ts     # socket.io wiring
│       └── socket.ts     # socket factory (client)
├── prisma/
│   └── schema.prisma     # Player model (SQLite)
├── AGENTS.md             # rules for AI agents
├── CLAUDE.md             # rules for Claude Code
└── package.json
```

## Deployment

The game uses WebSockets and a persistent Node process, so classic serverless hosting (Vercel Functions) will not work. Options: **Railway**, **Render**, **Fly.io** or your own VPS — run `npm run build` + `npm start`, the port is set via the `PORT` variable.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Realtime | socket.io 4 (custom server) |
| Rendering | HTML5 Canvas 2D |
| Styling | Tailwind CSS 4 |
| Database | SQLite + Prisma 6 |

## License

This project is licensed under the [MIT License](./LICENSE).
