"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { createGameSocket } from "@/lib/game/socket";
import type { Socket } from "socket.io-client";
import {
  BULLET_RADIUS,
  LOBBY_MIN_PLAYERS,
  ObstacleState,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  Snapshot,
  WEAPONS,
  WeaponId,
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

function hpColor(pct: number): string {
  if (pct > 50) return "#6EE7A0";
  if (pct > 25) return "#FCD34D";
  return "#F87171";
}

const INTERP_MS = 50; // период снапшотов сервера
const INPUT_DT = 0.05; // шаг отправки ввода (сек)

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Интерполяция угла по короткой дуге */
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

const clampV = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Пересечение отрезка с окружностью — зеркало серверной проверки (для локальных пуль) */
function segHitsCircle(
  x1: number, y1: number, x2: number, y2: number,
  cx: number, cy: number, r: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / lenSq : 0;
  t = clampV(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey <= r * r;
}

/** Один шаг движения игрока — точная копия серверной физики (препятствия + границы) */
function stepPlayer(
  x: number, y: number, mx: number, my: number, dt: number,
  obstacles: ObstacleState[],
): { x: number; y: number } {
  let vx = mx;
  let vy = my;
  const mag = Math.hypot(vx, vy);
  if (mag > 1) {
    vx /= mag;
    vy /= mag;
  }
  x += vx * PLAYER_SPEED * dt;
  y += vy * PLAYER_SPEED * dt;
  for (const o of obstacles) {
    if (o.kind === "bush") continue;
    const dx = x - o.x;
    const dy = y - o.y;
    const d = Math.hypot(dx, dy);
    const min = o.r + PLAYER_RADIUS;
    if (d < min && d > 0) {
      x = o.x + (dx / d) * min;
      y = o.y + (dy / d) * min;
    }
  }
  x = clampV(x, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);
  y = clampV(y, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);
  return { x, y };
}

/** Локально предсказанная пуля (рисуется мгновенно, урон считает сервер) */
interface LocalBullet {
  id: number;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
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
  const prevSnapRef = useRef<Snapshot | null>(null);
  const currSnapRef = useRef<Snapshot | null>(null);
  const recvTimeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const camRef = useRef({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, init: false });
  const predRef = useRef({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, init: false });
  const pendingRef = useRef<{ seq: number; mx: number; my: number }[]>([]);
  const localBulletsRef = useRef<LocalBullet[]>([]);
  const localIdRef = useRef(1);
  const cooldownRef = useRef(0);
  const weaponRef = useRef<WeaponId>("pistol");
  const wasAliveRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let seq = 0; // номер пакета ввода (для серверной реконсиляции)
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
      // Полный сброс предсказания при входе/переподключении
      predRef.current = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, init: false };
      camRef.current.init = false;
      pendingRef.current = [];
      localBulletsRef.current = [];
      cooldownRef.current = 0;
      weaponRef.current = "pistol";
      wasAliveRef.current = false;
      seq = 0;
    });

    socket.on("state", (s: Snapshot) => {
      const prev = prevPhaseRef.current;
      if (prev === "playing" && s.phase === "results") onStatsChanged();
      prevPhaseRef.current = s.phase;
      if (s.phase === "lobby" && prev !== "lobby") predRef.current.init = false;
      prevSnapRef.current = currSnapRef.current;
      currSnapRef.current = s;
      recvTimeRef.current = performance.now();

      // --- Реконсиляция: серверная позиция + реплей неподтверждённого ввода ---
      const me = s.players.find((p) => p.id === meIdRef.current) ?? null;
      if (me && me.alive && !me.spectator) {
        const srvSeq = me.seq || 0;
        while (pendingRef.current.length && pendingRef.current[0].seq <= srvSeq) {
          pendingRef.current.shift();
        }
        let px = me.x;
        let py = me.y;
        for (const inp of pendingRef.current) {
          const r = stepPlayer(px, py, inp.mx, inp.my, INPUT_DT, obstaclesRef.current);
          px = r.x;
          py = r.y;
        }
        if (!predRef.current.init || !wasAliveRef.current) {
          predRef.current.x = px;
          predRef.current.y = py;
          predRef.current.init = true;
        } else {
          const err = Math.hypot(px - predRef.current.x, py - predRef.current.y);
          if (err > 80) {
            predRef.current.x = px;
            predRef.current.y = py;
          }
        }
        wasAliveRef.current = true;
      } else {
        wasAliveRef.current = false;
        localBulletsRef.current = [];
      }
      // Смена оружия — мгновенная готовность выстрела
      if (me && me.weapon !== weaponRef.current) {
        weaponRef.current = me.weapon;
        cooldownRef.current = 0;
      }
      if (s.phase !== "playing") localBulletsRef.current = [];

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

    // ----- Отправка ввода 20 раз в секунду (с номером пакета) -----
    const readInput = () => {
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
      } else if (mouseRef.current.seen) {
        // Прицел считается от предсказанной позиции — без рывков при движении
        const bx = predRef.current.init ? predRef.current.x : me ? me.x : 0;
        const by = predRef.current.init ? predRef.current.y : me ? me.y : 0;
        const wx = bx + (mouseRef.current.x - window.innerWidth / 2);
        const wy = by + (mouseRef.current.y - window.innerHeight / 2);
        aim = Math.atan2(wy - by, wx - bx);
        shoot = mouseRef.current.down;
      }
      return { mx, my, aim, shoot };
    };
    const sendInput = () => {
      const inp = readInput();
      seq++;
      socket.emit("input", { seq, mx: inp.mx, my: inp.my, aim: inp.aim, shoot: inp.shoot });
      pendingRef.current.push({ seq, mx: inp.mx, my: inp.my });
      if (pendingRef.current.length > 40) pendingRef.current.shift();
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

      // --- Время кадра ---
      const now = performance.now();
      const dt = Math.min(0.05, (now - (lastFrameRef.current || now)) / 1000);
      lastFrameRef.current = now;

      // --- Клиентское предсказание своего движения (мгновенная реакция) ---
      const canPredict = !!me && me.alive && !me.spectator && s.phase !== "results";
      if (canPredict && predRef.current.init) {
        const inp = readInput();
        const r = stepPlayer(predRef.current.x, predRef.current.y, inp.mx, inp.my, dt, obstaclesRef.current);
        predRef.current.x = r.x;
        predRef.current.y = r.y;
      }

      // --- Локальные выстрелы: пуля рисуется мгновенно, урон считает сервер ---
      if (canPredict && me) {
        const inp = readInput();
        cooldownRef.current -= dt;
        if (inp.shoot && cooldownRef.current <= 0) {
          const spec = WEAPONS[weaponRef.current];
          cooldownRef.current = spec.cooldown;
          for (let i = 0; i < spec.pellets; i++) {
            const a = inp.aim + (Math.random() * 2 - 1) * spec.spread;
            const off = PLAYER_RADIUS + BULLET_RADIUS + 4;
            localBulletsRef.current.push({
              id: localIdRef.current++,
              color: me.color,
              x: predRef.current.x + Math.cos(a) * off,
              y: predRef.current.y + Math.sin(a) * off,
              vx: Math.cos(a) * spec.bulletSpeed,
              vy: Math.sin(a) * spec.bulletSpeed,
              life: spec.bulletLife,
            });
          }
        }
      }
      // Симуляция локальных пуль: движение, время жизни, препятствия
      {
        const kept: LocalBullet[] = [];
        for (const b of localBulletsRef.current) {
          b.life -= dt;
          if (b.life <= 0) continue;
          const nx = b.x + b.vx * dt;
          const ny = b.y + b.vy * dt;
          if (nx < 0 || ny < 0 || nx > WORLD_SIZE || ny > WORLD_SIZE) continue;
          let blocked = false;
          for (const o of obstaclesRef.current) {
            if (o.kind === "bush") continue;
            if (segHitsCircle(b.x, b.y, nx, ny, o.x, o.y, o.r)) {
              blocked = true;
              break;
            }
          }
          if (blocked) continue;
          b.x = nx;
          b.y = ny;
          kept.push(b);
        }
        localBulletsRef.current = kept;
      }

      // --- Интерполяция снапшотов (20 Гц) для чужих игроков, пуль и зоны ---
      const alpha = Math.max(0, Math.min(1.15, (now - recvTimeRef.current) / INTERP_MS));
      const prevS = prevSnapRef.current;
      const prevOk = prevS && prevS.phase === s.phase ? prevS : null;
      const prevPlayers = prevOk ? new Map(prevOk.players.map((p) => [p.id, p] as const)) : null;
      const prevBullets = prevOk ? new Map(prevOk.bullets.map((b) => [b.id, b] as const)) : null;
      const pz = prevOk ? prevOk.zone : null;

      const renderPlayers = s.players.map((p) => {
        if (p.id === meIdRef.current && predRef.current.init && p.alive && !p.spectator) {
          return { ...p, x: predRef.current.x, y: predRef.current.y, angle: readInput().aim };
        }
        const pp = prevPlayers?.get(p.id);
        if (!pp || pp.alive !== p.alive || Math.hypot(p.x - pp.x, p.y - pp.y) > 180) return p;
        return {
          ...p,
          x: lerp(pp.x, p.x, alpha),
          y: lerp(pp.y, p.y, alpha),
          angle: lerpAngle(pp.angle, p.angle, alpha),
          hp: lerp(pp.hp, p.hp, alpha),
        };
      });
      const renderBullets = s.bullets
        .filter((b) => b.ownerId !== meIdRef.current)
        .map((b) => {
          const pb = prevBullets?.get(b.id);
          if (!pb) return b;
          return { ...b, x: lerp(pb.x, b.x, alpha), y: lerp(pb.y, b.y, alpha) };
        });
      const renderZone = pz
        ? {
            ...s.zone,
            x: lerp(pz.x, s.zone.x, alpha),
            y: lerp(pz.y, s.zone.y, alpha),
            r: lerp(pz.r, s.zone.r, alpha),
          }
        : s.zone;

      // --- Камера плавно следует за своим персонажем / зоной ---
      const rme = renderPlayers.find((p) => p.id === meIdRef.current) ?? null;
      const tx = rme ? rme.x : renderZone.x;
      const ty = rme ? rme.y : renderZone.y;
      if (!camRef.current.init && me) {
        camRef.current.x = tx;
        camRef.current.y = ty;
        camRef.current.init = true;
      }
      const ck = 1 - Math.exp(-18 * dt);
      camRef.current.x += (tx - camRef.current.x) * ck;
      camRef.current.y += (ty - camRef.current.y) * ck;
      const camX = camRef.current.x;
      const camY = camRef.current.y;
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
      const zx = renderZone.x + ox;
      const zy = renderZone.y + oy;
      ctx.fillStyle = "rgba(167,139,250,0.30)";
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(zx, zy, Math.max(0, renderZone.r), 0, Math.PI * 2);
      ctx.fill("evenodd");
      ctx.strokeStyle = "#8B5CF6";
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(zx, zy, Math.max(0, renderZone.r), 0, Math.PI * 2);
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

      // Пули: чужие с сервера (с интерполяцией) + свои локальные (мгновенные)
      const allBullets = [...renderBullets, ...localBulletsRef.current];
      for (const b of allBullets) {
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
      for (const p of renderPlayers) {
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

      {/* Верх слева: живые/место и сводка */}
      <div className="absolute top-3 left-4 text-white font-bold text-sm" style={HUD_SHADOW}>
        <div>
          Живых: {snap ? snap.aliveCount : "—"}
          {me && !me.alive && me.place > 0 ? ` · Место #${me.place}` : ""}
        </div>
        <div className="text-white/85">
          {meName} · {me ? WEAPONS[me.weapon].name : "..."} · Убийств: {me ? me.kills : "—"}
        </div>
      </div>

      {/* Верх центр: фаза раунда */}
      <div
        className="absolute top-16 sm:top-3 left-1/2 -translate-x-1/2 w-full sm:w-auto px-4 sm:px-0 text-center text-white font-bold text-sm pointer-events-none"
        style={HUD_SHADOW}
      >
        {snap?.phase === "playing" && (
          <div className={snap.zone.shrinking ? "text-violet-200" : "text-white/90"}>
            {snap.zone.shrinking ? "ЗОНА СУЖАЕТСЯ!" : `Шторм через ${snap.phaseTime}с`} · {snap.zone.dps} урон/с
          </div>
        )}
        {snap?.phase === "lobby" && (
          <div className="text-white/90">
            Разминка · игроков {snap.playersInLobby}/{LOBBY_MIN_PLAYERS} — ждём соперника
          </div>
        )}
        {snap?.phase === "countdown" && <div className="text-amber-200">Раунд через {snap.phaseTime}с</div>}
        {snap?.phase === "results" && <div className="text-violet-200">Раунд завершён</div>}
        {status !== "online" && (
          <div className="mt-1 text-amber-300">
            {status === "connecting" ? "Подключение..." : "Переподключение..."}
          </div>
        )}
      </div>

      {/* Правый верх: килл-фид */}
      <div
        className="absolute top-3 right-4 flex flex-col items-end gap-1 max-w-[300px] pointer-events-none"
        style={HUD_SHADOW}
      >
        {feed.map((f) => (
          <div key={f.id} className="text-xs font-semibold text-white/95">
            {f.kind === "kill" ? (
              <>
                <b className={f.killer === "Зона" ? "text-violet-200" : "text-rose-200"}>{f.killer}</b>{" "}
                выбил <b>{f.victim}</b> <span className="text-white/60">({f.weapon})</span>
              </>
            ) : (
              <>
                <b>{f.victim}</b> подобрал <span className="text-amber-200">{f.weapon}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Центральные оверлеи */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {snap?.phase === "countdown" && (
          <div
            className="text-white font-extrabold text-[110px] leading-none animate-pulse"
            style={{ textShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
          >
            {snap.phaseTime}
          </div>
        )}
        {snap?.phase === "playing" && me && !me.alive && !me.spectator && (
          <DarkPanel>
            <div className="text-3xl font-extrabold">Ты выбыл</div>
            <div className="mt-2 font-semibold text-white/75">
              Место #{me.place} · наблюдаем до конца раунда
            </div>
          </DarkPanel>
        )}
        {snap?.phase === "playing" && me && me.spectator && (
          <DarkPanel>
            <div className="text-2xl font-extrabold">Режим наблюдателя</div>
            <div className="mt-2 font-semibold text-white/75">
              Раунд уже идёт — в следующий попадёшь сразу
            </div>
          </DarkPanel>
        )}
        {snap?.phase === "results" && (
          <DarkPanel className="min-w-[300px]">
            <div className="text-3xl font-extrabold">
              {snap.winner ? `Победил ${snap.winner}!` : "Ничья"}
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {snap.results.slice(0, 5).map((r, i) => (
                <div key={r.name + i} className="flex justify-between gap-6 text-sm font-semibold text-white/85">
                  <span>
                    {i + 1}. {r.name}
                    {r.win && <Trophy className="inline w-3.5 h-3.5 ml-1 mb-0.5 text-amber-400" />}
                  </span>
                  <span>убийств: {r.kills}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-sm font-semibold text-white/60">
              Новый раунд через {snap.phaseTime}с
            </div>
          </DarkPanel>
        )}
      </div>

      {/* Низ слева: выход */}
      <button
        onClick={onExit}
        className="absolute bottom-4 left-4 rounded-full bg-stone-950/50 hover:bg-stone-950/70 text-white text-sm font-bold px-5 py-2 backdrop-blur-sm transition-colors"
      >
        В меню
      </button>

      {/* Низ справа: подсказка */}
      <div
        className="absolute bottom-4 right-4 hidden sm:block text-xs font-semibold text-white/80"
        style={HUD_SHADOW}
      >
        WASD + мышь · на телефоне: два стика
      </div>
    </div>
  );
}

const HUD_SHADOW: React.CSSProperties = {
  textShadow: "0 1px 3px rgba(0,0,0,0.65), 0 0 7px rgba(0,0,0,0.3)",
};

function DarkPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-stone-950/70 backdrop-blur-md text-white rounded-2xl px-8 py-6 text-center shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}
