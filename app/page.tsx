"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gamepad2,
  Play,
  RotateCcw,
  Smartphone,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
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

function CartoonCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border-[3px] border-stone-800 bg-white/85 shadow-[5px_5px_0_0_#292524] ${className}`}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [lb, setLb] = useState<LbPlayer[]>([]);
  const [lbError, setLbError] = useState(false);

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-100 px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        {/* Заголовок */}
        <header className="text-center">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-stone-800">
            BUBBLE{" "}
            <span className="inline-block bg-rose-300 border-[3px] border-stone-800 rounded-2xl px-3 rotate-2 shadow-[5px_5px_0_0_#292524]">
              BATTLE
            </span>
          </h1>
          <p className="mt-4 text-lg text-stone-600 font-semibold">
            Мультяшная королевская битва .io — стреляй, собирай лут, переживи шторм!
          </p>
        </header>

        {/* Вход в игру */}
        <CartoonCard className="p-6">
          <label className="block text-sm font-bold text-stone-700 mb-2" htmlFor="nick">
            Твой ник
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              id="nick"
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              placeholder="Как тебя звать?"
              className="h-12 text-lg border-[3px] border-stone-800 rounded-2xl bg-white font-semibold"
            />
            <Button
              onClick={start}
              className="h-12 px-8 text-lg font-extrabold border-[3px] border-stone-800 rounded-2xl bg-rose-300 text-stone-900 hover:bg-rose-400 shadow-[4px_4px_0_0_#292524] active:translate-y-0.5"
            >
              <Play className="w-5 h-5 mr-1" /> Играть
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-stone-600">
            <Users className="w-4 h-4 shrink-0" />
            Нужно минимум 2 игрока: открой игру во второй вкладке — и раунд начнётся автоматически.
          </p>
        </CartoonCard>

        {/* Управление */}
        <div className="grid gap-4 sm:grid-cols-2">
          <CartoonCard className="p-5">
            <h2 className="flex items-center gap-2 font-extrabold text-stone-800 mb-2">
              <Gamepad2 className="w-5 h-5" /> Компьютер
            </h2>
            <ul className="text-sm text-stone-600 space-y-1">
              <li>
                <b>WASD / стрелки</b> — движение
              </li>
              <li>
                <b>Мышь</b> — прицел, <b>ЛКМ</b> — стрельба
              </li>
            </ul>
          </CartoonCard>
          <CartoonCard className="p-5">
            <h2 className="flex items-center gap-2 font-extrabold text-stone-800 mb-2">
              <Smartphone className="w-5 h-5" /> Телефон
            </h2>
            <ul className="text-sm text-stone-600 space-y-1">
              <li>
                <b>Левый стик</b> — движение
              </li>
              <li>
                <b>Правый стик</b> — прицел и стрельба
              </li>
            </ul>
          </CartoonCard>
        </div>

        {/* Лидерборд */}
        <CartoonCard className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 font-extrabold text-stone-800 text-lg">
              <Trophy className="w-5 h-5 text-amber-500" /> Таблица лидеров
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadLb}
              className="border-[3px] border-stone-800 rounded-xl bg-white font-bold shadow-[2px_2px_0_0_#292524]"
            >
              <RotateCcw className="w-4 h-4" /> Обновить
            </Button>
          </div>
          {lbError ? (
            <p className="text-sm text-stone-500">Не удалось загрузить таблицу. Попробуй обновить.</p>
          ) : lb.length === 0 ? (
            <p className="text-sm text-stone-500">Пока никто не побеждал. Стань первым!</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {lb.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-2xl border-2 border-stone-200 bg-white px-3 py-2 ${
                    i === 0 ? "border-amber-400 bg-amber-50" : ""
                  }`}
                >
                  <span
                    className="w-7 h-7 shrink-0 rounded-full border-2 border-stone-800 flex items-center justify-center text-xs font-extrabold text-stone-800"
                    style={{ background: MEDALS[i] ?? "#F5F5F4" }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 font-bold text-stone-800 truncate">{p.name}</span>
                  <span className="flex items-center gap-1 text-sm text-stone-600">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" /> {p.wins}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-stone-600">
                    <Swords className="w-3.5 h-3.5 text-rose-400" /> {p.kills}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CartoonCard>

        <footer className="text-center text-sm text-stone-500 pb-4">
          Сделано на Next.js + socket.io · победитель определяется по последнему выжившему
        </footer>
      </div>
    </main>
  );
}
