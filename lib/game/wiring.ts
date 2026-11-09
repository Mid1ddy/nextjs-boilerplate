/**
 * Привязка socket.io к игровому миру — общий модуль для песочницы
 * (мини-сервис на порту 3003) и репозитория (custom server).
 * Вся реалтайм-логика тут: join/input/state + автосохранение результатов.
 */

import type { Server as IOServer } from "socket.io";
import { GameWorld } from "./engine";
import { InputPayload, RoundResult } from "./shared";

export interface GameServerOptions {
  /** Вызывается в конце раунда — реализация сохранения зависит от окружения */
  saveResults?: (results: RoundResult[]) => Promise<void>;
  onLog?: (msg: string) => void;
}

export function attachGameServer(io: IOServer, opts: GameServerOptions = {}): GameWorld {
  const log = (m: string) => opts.onLog?.(m);

  const world = new GameWorld({
    onRoundEnd: (results) => {
      log(`Сохраняю результаты раунда (${results.length} игроков)`);
      if (opts.saveResults) {
        opts.saveResults(results).catch((e) => log(`Ошибка сохранения результатов: ${String(e)}`));
      }
    },
    onLog: log,
  });
  world.start();

  io.on("connection", (socket) => {
    let joined = false;

    socket.on("join", (data: { name?: string }) => {
      if (joined) return;
      joined = true;
      const raw = typeof data?.name === "string" ? data.name : "";
      const name = raw.trim().slice(0, 12) || "Игрок";
      world.join(socket.id, name);
      // Статичный мир отправляем один раз при входе
      socket.emit("joined", { id: socket.id, name, obstacles: world.obstacles });
    });

    socket.on("input", (data: Partial<InputPayload>) => {
      if (!data || typeof data !== "object") return;
      world.setInput(socket.id, {
        mx: Number(data.mx) || 0,
        my: Number(data.my) || 0,
        aim: Number(data.aim) || 0,
        shoot: !!data.shoot,
        seq: typeof data.seq === "number" ? data.seq : undefined,
      });
    });

    socket.on("disconnect", () => {
      world.leave(socket.id);
    });

    socket.on("error", (e) => {
      log(`Ошибка сокета ${socket.id}: ${String(e)}`);
    });
  });

  // Снапшот состояния всем клиентам 20 раз в секунду
  const broadcast = setInterval(() => {
    io.emit("state", world.snapshot());
  }, 50);

  return world;
}
