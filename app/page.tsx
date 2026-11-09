"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, RotateCcw, Swords, Trophy } from "lucide-react";
import GameCanvas from "@/components/game/GameCanvas";

type LbPlayer = {
  id: number;
  name: string;
  wins: number;
  kills: number;
  rounds: number;
};

const RANDOM_NAMES = ["Пончик", "Зефирка", "Кексик", "Пузырик", "Маршмеллоу", "Ватрушка", "Булочка", "Эклер"];
const MEDALS = ["#FACC15", "#C0C0C0", "#CD7F32"];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/* ------------------------------------------------------------------ */
/* Живой мир за меню — как в настоящих .io играх                       */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORLD = 2600;
const BOT_COLORS = ["#FB7185", "#FBBF24", "#34D399", "#38BDF8", "#A78BFA", "#F472B6", "#4ADE80"];

interface Spot {
  x: number;
  y: number;
  r: number;
}

interface Bot {
  x: number;
  y: number;
  a: number;
  speed: number;
  color: string;
}

function MenuWorld() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rand = mulberry32(20261109);
    const M = 240;
    const spots = (count: number, rMin: number, rMax: number): Spot[] =>
      Array.from({ length: count }, () => ({
        x: M + rand() * (WORLD - 2 * M),
        y: M + rand() * (WORLD - 2 * M),
        r: rMin + rand() * (rMax - rMin),
      }));

    const trees = spots(38, 26, 44);
    const rocks = spots(20, 20, 34);
    const bushes = spots(24, 24, 38);
    const crates = spots(12, 0, 0);

    const bots: Bot[] = BOT_COLORS.map((color) => ({
      x: 300 + rand() * (WORLD - 600),
      y: 300 + rand() * (WORLD - 600),
      a: rand() * Math.PI * 2,
      speed: 42 + rand() * 34,
      color,
    }));

    let raf = 0;
    let last = performance.now();

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

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now * 0.001;

      // Боты бродят по миру
      for (const b of bots) {
        b.a += (Math.random() - 0.5) * 2.2 * dt;
        b.x += Math.cos(b.a) * b.speed * dt;
        b.y += Math.sin(b.a) * b.speed * dt;
        if (b.x < 220 || b.x > WORLD - 220) b.a = Math.PI - b.a;
        if (b.y < 220 || b.y > WORLD - 220) b.a = -b.a;
        b.x = clamp(b.x, 220, WORLD - 220);
        b.y = clamp(b.y, 220, WORLD - 220);
      }

      // Камера медленно дрейфует
      const w = window.innerWidth;
      const h = window.innerHeight;
      const camX = WORLD / 2 + Math.cos(t * 0.05) * 340;
      const camY = WORLD / 2 + Math.sin(t * 0.037) * 280;
      const ox = w / 2 - camX;
      const oy = h / 2 - camY;

      ctx.fillStyle = "#FDF3E3";
      ctx.fillRect(0, 0, w, h);

      // Пятна травы
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

      // Затемнение за пределами мира и граница
      ctx.fillStyle = "rgba(196,154,108,0.14)";
      const wx0 = ox, wy0 = oy, wx1 = WORLD + ox, wy1 = WORLD + oy;
      if (wx0 > 0) ctx.fillRect(0, 0, wx0, h);
      if (wx1 < w) ctx.fillRect(wx1, 0, w - wx1, h);
      if (wy0 > 0) ctx.fillRect(Math.max(0, wx0), 0, Math.min(w, wx1) - Math.max(0, wx0), wy0);
      if (wy1 < h) ctx.fillRect(Math.max(0, wx0), wy1, Math.min(w, wx1) - Math.max(0, wx0), h - wy1);
      ctx.strokeStyle = "#D9BFA8";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.roundRect(4 + ox, 4 + oy, WORLD - 8, WORLD - 8, 48);
      ctx.stroke();

      // Ящики
      for (const c of crates) {
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

      // Кусты, камни, деревья
      for (const b of bushes) {
        ctx.fillStyle = "rgba(165,214,167,0.8)";
        ctx.strokeStyle = "#81C784";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x + ox, b.y + oy, b.r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      for (const r of rocks) {
        ctx.fillStyle = "#CBC4BA";
        ctx.strokeStyle = "#A69E92";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x + ox, r.y + oy, r.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#DBD5CC";
        ctx.beginPath();
        ctx.arc(r.x - r.r * 0.25 + ox, r.y - r.r * 0.3 + oy, r.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const tr of trees) {
        ctx.fillStyle = "#B08968";
        ctx.beginPath();
        ctx.arc(tr.x + ox, tr.y + oy, tr.r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8CD98C";
        ctx.strokeStyle = "#5BAF5B";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tr.x + ox, tr.y + oy, tr.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#AEE8AE";
        ctx.beginPath();
        ctx.arc(tr.x - tr.r * 0.3 + ox, tr.y - tr.r * 0.35 + oy, tr.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Пузыри-боты с рожицами
      for (const b of bots) {
        const x = b.x + ox;
        const y = b.y + oy;
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.ellipse(x, y + 20, 22, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.color;
        ctx.strokeStyle = "#4B5563";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#334155";
        for (const off of [-0.42, 0.42]) {
          ctx.beginPath();
          ctx.arc(x + Math.cos(b.a + off) * 9, y + Math.sin(b.a + off) * 9, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x + Math.cos(b.a) * 11, y + Math.sin(b.a) * 11, 4.5, b.a - 0.7, b.a + 0.7);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}

/* ------------------------------------------------------------------ */
/* Логотип в духе .io игр                                              */
/* ------------------------------------------------------------------ */

const LOGO_PALETTE = ["#FB7185", "#FBBF24", "#34D399", "#38BDF8", "#A78BFA", "#F472B6"];

function LogoWord({ text, offset }: { text: string; offset: number }) {
  return (
    <span className="flex">
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            color: LOGO_PALETTE[(i + offset) % LOGO_PALETTE.length],
            WebkitTextStroke: "2.5px #1C1917",
            paintOrder: "stroke fill",
            textShadow: "0 5px 0 rgba(0,0,0,0.28)",
            transform: `translateY(${i % 2 === 0 ? -3 : 3}px)`,
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function CornerButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-sm font-semibold px-4 py-2 backdrop-blur-sm transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */

export default function Home() {
  const [name, setName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [lb, setLb] = useState<LbPlayer[]>([]);
  const [lbError, setLbError] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLb, setShowLb] = useState(false);

  const loadLb = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      const data = await res.json();
      setLb(Array.isArray(data.players) ? data.players : []);
      setLbError(false);
    } catch {
      setLbError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLb();
  }, [loadLb]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = localStorage.getItem("bb-name");
    if (saved) {
      setName(saved);
    } else {
      setName(
        RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)] +
          Math.floor(10 + Math.random() * 90),
      );
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (playing) {
    return (
      <GameCanvas
        name={name.trim().slice(0, 12) || "Игрок"}
        onExit={() => setPlaying(false)}
        onStatsChanged={loadLb}
      />
    );
  }

  const start = () => {
    const clean = name.trim().slice(0, 12) || "Игрок";
    localStorage.setItem("bb-name", clean);
    setPlaying(true);
  };

  const toggleHelp = () => {
    setShowLb(false);
    setShowHelp((v) => !v);
  };
  const toggleLb = () => {
    setShowHelp(false);
    setShowLb((v) => {
      if (!v) loadLb();
      return !v;
    });
  };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-stone-900">
      <MenuWorld />
      <div className="absolute inset-0 bg-stone-950/60" />

      {/* Центр: логотип, ник, Play */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <h1 className="flex gap-4 sm:gap-6 font-black text-4xl sm:text-7xl tracking-wide">
          <LogoWord text="BUBBLE" offset={0} />
          <LogoWord text="BATTLE" offset={3} />
        </h1>

        <input
          value={name}
          maxLength={12}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
          placeholder="Ник"
          aria-label="Ник"
          className="mt-10 w-72 sm:w-80 h-12 rounded-full bg-white text-center text-lg font-semibold text-stone-800 placeholder:text-stone-400 shadow-lg outline-none focus:ring-4 focus:ring-emerald-400/50"
        />
        <button
          onClick={start}
          className="mt-4 w-72 sm:w-80 h-13 py-3.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-white text-lg font-extrabold tracking-wide shadow-[0_4px_0_#047857] active:translate-y-[2px] active:shadow-[0_2px_0_#047857] transition-all"
        >
          Играть
        </button>

        <p className="mt-5 text-sm text-white/55 text-center">
          Для раунда нужно два игрока — открой игру во второй вкладке
        </p>
      </div>

      {/* Панель управления (слева) */}
      {showHelp && (
        <div className="absolute bottom-20 left-4 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-stone-950/70 backdrop-blur-md p-4 shadow-2xl text-sm text-white/85">
          <h2 className="flex items-center gap-2 font-extrabold text-white mb-2">
            <Gamepad2 className="w-4 h-4" /> Управление
          </h2>
          <ul className="space-y-1.5">
            <li>
              <b>Компьютер:</b> WASD — движение, мышь — прицел, ЛКМ — огонь
            </li>
            <li>
              <b>Телефон:</b> левый стик — движение, правый — прицел и огонь
            </li>
            <li>
              <b>Цель:</b> открывай ящики, подбирай оружие и останься последним
            </li>
          </ul>
        </div>
      )}

      {/* Панель лидеров (справа) */}
      {showLb && (
        <div className="absolute bottom-20 right-4 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-stone-950/70 backdrop-blur-md p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 font-extrabold text-white">
              <Trophy className="w-4 h-4 text-amber-400" /> Лидеры
            </h2>
            <button
              onClick={loadLb}
              className="flex items-center gap-1 text-xs font-semibold text-white/60 hover:text-white"
            >
              <RotateCcw className="w-3 h-3" /> Обновить
            </button>
          </div>
          {lbError ? (
            <p className="text-sm text-white/50">Не удалось загрузить. Попробуй обновить.</p>
          ) : lb.length === 0 ? (
            <p className="text-sm text-white/50">Пока никто не побеждал. Стань первым!</p>
          ) : (
            <div className="flex flex-col gap-2">
              {lb.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <span
                    className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-extrabold"
                    style={{
                      background: MEDALS[i] ?? "rgba(255,255,255,0.14)",
                      color: MEDALS[i] ? "#1C1917" : "rgba(255,255,255,0.8)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 font-semibold text-white truncate">{p.name}</span>
                  <span className="flex items-center gap-1 text-xs text-white/70">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" /> {p.wins}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/70">
                    <Swords className="w-3.5 h-3.5 text-rose-300" /> {p.kills}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Угловые кнопки */}
      <div className="absolute bottom-4 left-4">
        <CornerButton icon={<Gamepad2 className="w-4 h-4" />} label="Как играть" onClick={toggleHelp} />
      </div>
      <div className="absolute bottom-4 right-4">
        <CornerButton icon={<Trophy className="w-4 h-4" />} label="Лидеры" onClick={toggleLb} />
      </div>
    </div>
  );
}
