"use client";

import { io, Socket } from "socket.io-client";

/**
 * Фабрика игрового сокета.
 * В песочнице адрес задаётся через env (гейтвей Caddy с XTransformPort),
 * в репозитории — подключение к тому же origin (custom server).
 */
export function createGameSocket(): Socket {
  return io(process.env.NEXT_PUBLIC_SOCKET_URL || "/", {
    path: process.env.NEXT_PUBLIC_SOCKET_PATH || "/socket.io",
    transports: ["websocket", "polling"],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
}
