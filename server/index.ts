/**
 * Custom server BUBBLE BATTLE: Next.js + socket.io в одном процессе.
 * Запуск: npm run dev (разработка) / npm run build && npm start (продакшен).
 */

import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { attachGameServer } from "../lib/game/wiring";
import { db } from "../lib/db";
import type { RoundResult } from "../lib/game/shared";

const dev = process.argv.includes("--dev");
const port = Number(process.env.PORT) || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

async function saveResults(results: RoundResult[]): Promise<void> {
  for (const r of results) {
    await db.player.upsert({
      where: { name: r.name },
      create: { name: r.name, kills: r.kills, wins: r.win ? 1 : 0, rounds: 1 },
      update: {
        kills: { increment: r.kills },
        wins: { increment: r.win ? 1 : 0 },
        rounds: { increment: 1 },
      },
    });
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  attachGameServer(io, {
    saveResults,
    onLog: (m) => console.log(`[game] ${m}`),
  });

  httpServer.listen(port, () => {
    console.log(`> BUBBLE BATTLE запущена: http://localhost:${port}${dev ? " (dev)" : ""}`);
  });
});
