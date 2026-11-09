"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createGameSocket } from "@/lib/game/socket";
import type { Socket } from "socket.io-client";
import {
  LOBBY_MIN_PLAYERS,
  ObstacleState,
  PLAYER_RADIUS,
  Snapshot,
  WEAPONS,
  WORLD_SIZE,
} from "@/lib/game/shared";

interface Props {
  name: string;
  onExit: () => void;
  onStatsChanged: () => void;
}

interface Stick {
  active: boolean;
  id: number;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
}

const STICK_MAX = 56;
const newStick = (): Stick => ({ active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 });
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function hpColor(pct: number): string {
  if (pct > 50) return "#6EE7A0";
  if (pct > 25) return "#FCD34D";
  return "#F87171";
}

export default function GameCanvas({ name, onExit, onStatsChanged }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [meName, setMeName] = useState(name);

  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef<Snapshot | null>(null);
  const obstaclesRef = useRef<ObstacleState[]>([]);
  const [meId, setMeId] = useState("");
  const meIdRef = useRef("");
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0, down: false, seen: false });
  const moveStickRef = useRef<Stick>(newStick());
  const aimStickRef = useRef<Stick>(newStick());
  const prevPhaseRef = useRef("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const socket = createGameSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("online");
      socket.emit("join", { name });
    });
    socket.on("disconnect", () => setStatus("offline"));
    socket.on("connect_error", () => setStatus("offline"));

    socket.on("joined", (data: { id: string; name: string; obstacles: ObstacleState[] }) => {
      meIdRef.current = data.id;
      setMeId(data.id);
      obstaclesRef.current = data.obstacles || [];
      setMeName(data.name);
    });

    socket.on("state", (s: Snapshot) => {
      const prev = prevPhaseRef.current;
      if (prev === "playing" && s.phase === "results") onStatsChanged();
      prevPhaseRef.current = s.phase;
      stateRef.current = s;
      setSnap(s);
    });

    // ----- Клавиатура -----
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);

    // ----- Мышь и тач-стики (pointer events) -----
    const onMouseMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
        mouseRef.current.seen = true;
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        mouseRef.current.down = true;
        mouseRef.current.seen = true;
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
        return;
      }
      e.preventDefault();
      const half = window.innerWidth / 2;
      const stick = e.clientX < half ? moveStickRef.current : aimStickRef.current;
      if (!stick.active) {
        stick.active = true;
        stick.id = e.pointerId;
        stick.ox = e.clientX;
        stick.oy = e.clientY;
        stick.dx = 0;
        stick.dy = 0;
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ок */ }
      }
    };
    const onPointerMoveStick = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      for (const stick of [moveStickRef.current, aimStickRef.current]) {
        if (stick.active && stick.id === e.pointerId) {
          let dx = e.clientX - stick.ox;
          let dy = e.clientY - stick.oy;
          const mag = Math.hypot(dx, dy);
          if (mag > STICK_MAX) {
            dx = (dx / mag) * STICK_MAX;
            dy = (dy / mag) * STICK_MAX;
          }
          stick.dx = dx;
          stick.dy = dy;
        }
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        mouseRef.current.down = false;
        return;
      }
      for (const stick of [moveStickRef.current, aimStickRef.current]) {
        if (stick.active && stick.id === e.pointerId) {
          stick.active = false;
          stick.dx = 0;
          stick.dy = 0;
        }
      }
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onBlur = () => {
      keysRef.current.clear();
      mouseRef.current.down = false;
      moveStickRef.current = newStick();
      aimStickRef.current = newStick();
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointermove", onMouseMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMoveStick);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    // ----- Размеры -----
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ----- Отправка ввода 20 раз в секунду -----
    const sendInput = () => {
      const s = stateRef.current;
      const me = s?.players.find((p) => p.id === meIdRef.current) ?? null;
      const k = keysRef.current;
      let mx =
        (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) -
        (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
      let my =
        (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) -
        (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0);
      if (moveStickRef.current.active) {
        mx = moveStickRef.current.dx / STICK_MAX;
        my = moveStickRef.current.dy / STICK_MAX;
      }
      let aim = me ? me.angle : 0;
      let shoot = false;
      const st = aimStickRef.current;
      if (st.active) {
        const mag = Math.hypot(st.dx, st.dy);
        if (mag > 10) aim = Math.atan2(st.dy, st.dx);
        shoot = mag > 18;
      } else if (mouseRef.current.seen && me) {
        const wx = me.x + (mouseRef.current.x - window.innerWidth / 2);
        const wy = me.y + (mouseRef.current.y - window.innerHeight / 2);
        aim = Math.atan2(wy - me.y, wx - me.x);
        shoot = mouseRef.current.down;
      }
      socket.emit("input", { mx, my, aim, shoot });
    };
    const sender = setInterval(sendInput, 50);

    // ----- Рендер -----
    let raf = 0;
    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.fillStyle = "#FDF3E3";
      ctx.fillRect(0, 0, w, h);

      const s = stateRef.current;
      if (!s) {
        ctx.fillStyle = "#78716C";
        ctx.font = "bold 16px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Подключение к серверу...", w / 2, h / 2);
        raf = requestAnimationFrame(draw);
        return;
      }

      const me = s.players.find((p) => p.id === meIdRef.current) ?? null;
      const camX = me ? me.x : s.zone.x;
      const camY = me ? me.y : s.zone.y;
      const ox = w / 2 - camX;
      const oy = h / 2 - camY;
      const inView = (x: number, y: number, r: number) =>
        x + r > camX - w / 2 - 50 &&
        x - r < camX + w / 2 + 50 &&
        y + r > camY - h / 2 - 50 &&
        y - r < camY + h / 2 + 50;

      // Трава (детерминированные пятна)
      const CELL = 170;
      const c0x = Math.floor((camX - w / 2) / CELL) - 1;
      const c1x = Math.floor((camX + w / 2) / CELL) + 1;
      const c0y = Math.floor((camY - h / 2) / CELL) - 1;
      const c1y = Math.floor((camY + h / 2) / CELL) + 1;
      ctx.fillStyle = "#EAF4E0";
      for (let cx = c0x; cx <= c1x; cx++) {
        for (let cy = c0y; cy <= c1y; cy++) {
          const hash = (cx * 374761393 + cy * 668265263) | 0;
          const m = ((hash % 97) + 97) % 97;
          if (m < 30) {
            const gx = cx * CELL + (m % 90) + 20;
            const gy = cy * CELL + (((hash >> 3) % 90) + 90) % 90 + 20;
            ctx.beginPath();
            ctx.arc(gx + ox, gy + oy, 36, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Затемнение за пределами мира
      ctx.fillStyle = "rgba(196,154,108,0.14)";
      const wx0 = ox, wy0 = oy, wx1 = WORLD_SIZE + ox, wy1 = WORLD_SIZE + oy;
      if (wx0 > 0) ctx.fillRect(0, 0, wx0, h);
      if (wx1 < w) ctx.fillRect(wx1, 0, w - wx1, h);
      if (wy0 > 0) ctx.fillRect(Math.max(0, wx0), 0, Math.min(w, wx1) - Math.max(0, wx0), wy0);
      if (wy1 < h) ctx.fillRect(Math.max(0, wx0), wy1, Math.min(w, wx1) - Math.max(0, wx0), h - wy1);

      // Граница мира
      ctx.strokeStyle = "#D9BFA8";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.roundRect(4 + ox, 4 + oy, WORLD_SIZE - 8, WORLD_SIZE - 8, 48);
      ctx.stroke();

      // Ящики
      for (const c of s.crates) {
        if (c.opened || !inView(c.x, c.y, 30)) continue;
        ctx.fillStyle = "#F5D9A8";
        ctx.strokeStyle = "#C89B62";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(c.x - 16 + ox, c.y - 16 + oy, 32, 32, 8);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c.x - 16 + ox, c.y - 16 + oy);
        ctx.lineTo(c.x + 16 + ox, c.y + 16 + oy);
        ctx.moveTo(c.x + 16 + ox, c.y - 16 + oy);
        ctx.lineTo(c.x - 16 + ox, c.y + 16 + oy);
        ctx.stroke();
      }

      // Препятствия
      for (const o of obstaclesRef.current) {
        if (!inView(o.x, o.y, o.r + 10)) continue;
        const x = o.x + ox;
        const y = o.y + oy;
        if (o.kind === "bush") {
          ctx.fillStyle = "rgba(165,214,167,0.8)";
          ctx.strokeStyle = "#81C784";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, o.r * 0.85, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (o.kind === "rock") {
          ctx.fillStyle = "#CBC4BA";
          ctx.strokeStyle = "#A69E92";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, o.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#DBD5CC";
          ctx.beginPath();
          ctx.arc(x - o.r * 0.25, y - o.r * 0.3, o.r * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "#B08968";
          ctx.beginPath();
          ctx.arc(x, y, o.r * 0.32, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#8CD98C";
          ctx.strokeStyle = "#5BAF5B";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, o.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#AEE8AE";
          ctx.beginPath();
          ctx.arc(x - o.r * 0.3, y - o.r * 0.35, o.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Зона (шторм) — заливка с дыркой по evenodd
      const zx = s.zone.x + ox;
      const zy = s.zone.y + oy;
      ctx.fillStyle = "rgba(167,139,250,0.30)";
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(zx, zy, Math.max(0, s.zone.r), 0, Math.PI * 2);
      ctx.fill("evenodd");
      ctx.strokeStyle = "#8B5CF6";
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(zx, zy, Math.max(0, s.zone.r), 0, Math.PI * 2);
      ctx.stroke();
      if (s.zone.shrinking) {
        ctx.strokeStyle = "rgba(139,92,246,0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(s.zone.targetX + ox, s.zone.targetY + oy, Math.max(0, s.zone.targetR), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Пули
      for (const b of s.bullets) {
        if (!inView(b.x, b.y, 20)) continue;
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.035 + ox, b.y - b.vy * 0.035 + oy);
        ctx.lineTo(b.x + ox, b.y + oy);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = b.color;
        ctx.strokeStyle = "#4B5563";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x + ox, b.y + oy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Игроки
      ctx.textAlign = "center";
      for (const p of s.players) {
        if (p.spectator || !p.alive) continue;
        if (!inView(p.x, p.y, 70)) continue;
        const x = p.x + ox;
        const y = p.y + oy;

        // Тень
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.ellipse(x, y + PLAYER_RADIUS * 0.85, PLAYER_RADIUS * 0.9, PLAYER_RADIUS * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Оружие (направлено по прицелу)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        ctx.fillStyle = "#6B7280";
        ctx.beginPath();
        ctx.roundRect(PLAYER_RADIUS - 4, -3, 17, 6, 3);
        ctx.fill();
        ctx.restore();

        // Кольцо своего игрока
        if (p.id === meIdRef.current) {
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Тело
        ctx.fillStyle = p.color;
        ctx.strokeStyle = "#4B5563";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Глаза и улыбка по направлению взгляда
        ctx.fillStyle = "#334155";
        for (const off of [-0.42, 0.42]) {
          ctx.beginPath();
          ctx.arc(x + Math.cos(p.angle + off) * 9, y + Math.sin(p.angle + off) * 9, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x + Math.cos(p.angle) * 11, y + Math.sin(p.angle) * 11, 4.5, p.angle - 0.7, p.angle + 0.7);
        ctx.stroke();

        // Имя и полоска HP
        const top = y - PLAYER_RADIUS - 16;
        ctx.font = "bold 12px ui-sans-serif, system-ui";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeText(p.name, x, top);
        ctx.fillStyle = "#334155";
        ctx.fillText(p.name, x, top);
        const bw = 44;
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#4B5563";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - bw / 2, top + 5, bw, 7, 3.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = hpColor(p.hp);
        ctx.beginPath();
        ctx.roundRect(x - bw / 2, top + 5, (bw * Math.max(0, p.hp)) / 100, 7, 3.5);
        ctx.fill();
      }

      // Прицел мыши
      if (mouseRef.current.seen && !aimStickRef.current.active) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        ctx.strokeStyle = "#57534E";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx, my, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx, my, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#57534E";
        ctx.fill();
      }

      // Тач-стики
      for (const stick of [moveStickRef.current, aimStickRef.current]) {
        if (!stick.active) continue;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.strokeStyle = "rgba(87,83,78,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(stick.ox, stick.oy, STICK_MAX, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.strokeStyle = "rgba(87,83,78,0.5)";
        ctx.beginPath();
        ctx.arc(stick.ox + stick.dx, stick.oy + stick.dy, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(sender);
      socket.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onMouseMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMoveStick);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", resize);
    };
  }, [name]);

  const me = snap?.players.find((p) => p.id === meId) ?? null;
  const feed = [...(snap?.feed ?? [])].reverse();

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#FDF3E3]">
      <canvas ref={canvasRef} className="absolute inset-0 touch-none cursor-none" />

      {/* Верх слева: статус раунда */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 items-start">
        <div className="flex gap-2">
          <Chip>Живых: {snap ? snap.aliveCount : "—"}</Chip>
          {me && !me.alive && me.place > 0 && <Chip>Место #{me.place}</Chip>}
        </div>
        <Chip className="bg-white/70">
          {meName} · {me ? WEAPONS[me.weapon].name : "..."} · Убийств: {me ? me.kills : "—"}
        </Chip>
      </div>

      {/* Верх центр: фаза */}
      <div className="absolute top-[88px] sm:top-3 left-1/2 -translate-x-1/2 w-full sm:w-auto px-2 sm:px-0 text-center">
        {snap?.phase === "playing" && (
          <Chip className={snap.zone.shrinking ? "bg-violet-200" : "bg-white/85"}>
            {snap.zone.shrinking ? "ЗОНА СУЖАЕТСЯ!" : `Шторм через ${snap.phaseTime}с`} · {snap.zone.dps} урон/с
          </Chip>
        )}
        {snap?.phase === "lobby" && (
          <Chip>
            Разминка · игроков {snap.playersInLobby}/{LOBBY_MIN_PLAYERS} — ждём соперника
          </Chip>
        )}
        {snap?.phase === "countdown" && <Chip className="bg-amber-200">Раунд через {snap.phaseTime}с</Chip>}
        {snap?.phase === "results" && <Chip className="bg-violet-200">Раунд завершён</Chip>}
        {status !== "online" && (
          <Chip className="bg-red-200 mt-2">
            {status === "connecting" ? "Подключение..." : "Переподключение..."}
          </Chip>
        )}
      </div>

      {/* Правый верх: килл-фид */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end max-w-[280px]">
        {feed.map((f) => (
          <div
            key={f.id}
            className="text-xs font-semibold bg-white/80 border-2 border-stone-300 rounded-lg px-2 py-1 text-stone-700"
          >
            {f.kind === "kill" ? (
              <>
                <b className={f.killer === "Зона" ? "text-violet-600" : "text-rose-500"}>{f.killer}</b>{" "}
                выбил <b>{f.victim}</b> <span className="text-stone-400">({f.weapon})</span>
              </>
            ) : (
              <>
                <b>{f.victim}</b> подобрал <span className="text-amber-600">{f.weapon}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Центральные оверлеи */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {snap?.phase === "countdown" && (
          <div className="text-stone-800 font-extrabold text-[110px] leading-none drop-shadow-[3px_3px_0_rgba(255,255,255,0.9)] animate-pulse">
            {snap.phaseTime}
          </div>
        )}
        {snap?.phase === "playing" && me && !me.alive && (
          <CenterCard>
            <div className="text-3xl font-extrabold text-stone-800">Ты выбыл</div>
            <div className="mt-2 text-stone-600 font-semibold">
              Место #{me.place} · наблюдаем до конца раунда
            </div>
          </CenterCard>
        )}
        {snap?.phase === "playing" && me && me.spectator && (
          <CenterCard>
            <div className="text-2xl font-extrabold text-stone-800">Режим наблюдателя</div>
            <div className="mt-2 text-stone-600 font-semibold">
              Раунд уже идёт — в следующий попадёшь сразу
            </div>
          </CenterCard>
        )}
        {snap?.phase === "results" && (
          <CenterCard className="min-w-[300px]">
            <div className="text-3xl font-extrabold text-stone-800">
              {snap.winner ? `Победил ${snap.winner}!` : "Ничья"}
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {snap.results.slice(0, 5).map((r, i) => (
                <div key={r.name + i} className="flex justify-between gap-6 text-sm font-semibold text-stone-700">
                  <span>
                    {i + 1}. {r.name}
                    {r.win && <Trophy className="inline w-3.5 h-3.5 ml-1 mb-0.5 text-amber-500" />}
                  </span>
                  <span>убийств: {r.kills}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-stone-500 text-sm font-semibold">
              Новый раунд через {snap.phaseTime}с
            </div>
          </CenterCard>
        )}
      </div>

      {/* Низ слева: выход */}
      <div className="absolute bottom-4 left-4">
        <Button
          onClick={onExit}
          className="border-[3px] border-stone-800 rounded-2xl bg-white/90 text-stone-800 font-bold hover:bg-white shadow-[3px_3px_0_0_#292524]"
        >
          В меню
        </Button>
      </div>

      {/* Низ справа: подсказка */}
      <div className="absolute bottom-4 right-4 hidden sm:block text-xs font-semibold text-stone-600 bg-white/70 rounded-lg px-2 py-1">
        WASD + мышь · на телефоне: два стика
      </div>
    </div>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block bg-white/85 border-[3px] border-stone-800 rounded-full px-3 py-1 text-sm font-bold text-stone-800 shadow-[3px_3px_0_0_#292524] ${className}`}
    >
      {children}
    </span>
  );
}

function CenterCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white/90 border-[3px] border-stone-800 rounded-3xl px-8 py-6 text-center shadow-[6px_6px_0_0_#292524] ${className}`}
    >
      {children}
    </div>
  );
}
