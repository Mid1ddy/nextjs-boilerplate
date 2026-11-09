/**
 * Игровой движок BUBBLE BATTLE — чистая логика без socket.io.
 * Сервер авторитетен: весь мир симулируется здесь, клиент только
 * отправляет ввод и рисует снапшоты.
 */

import {
  BULLET_RADIUS,
  COUNTDOWN_TIME,
  CRATE_RADIUS,
  FeedItem,
  GamePhase,
  InputPayload,
  LOBBY_MIN_PLAYERS,
  ObstacleState,
  PLAYER_COLORS,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  RESULTS_TIME,
  RoundResult,
  Snapshot,
  START_WEAPON,
  WEAPONS,
  WeaponId,
  WORLD_SIZE,
  ZONE_INITIAL_RADIUS,
  ZONE_PHASES,
  ZoneState,
} from "./shared";

/** Линейная интерполяция — используется при сжатии шторма */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface InternalPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  color: string;
  weapon: WeaponId;
  alive: boolean;
  spectator: boolean;
  kills: number;
  place: number;
  cooldown: number;
  seq: number; // последний применённый номер пакета ввода
  input: InputPayload;
}

interface InternalBullet {
  id: number;
  ownerId: string;
  color: string;
  damage: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface ZoneInternal extends ZoneState {
  fromX: number;
  fromY: number;
  fromR: number;
  phaseIndex: number;
  stage: "hold" | "shrink" | "done";
  stageTime: number;
}

export interface EngineHooks {
  onRoundEnd?: (results: RoundResult[]) => void;
  onLog?: (msg: string) => void;
}

const TICK_MS = 20; // 50 Гц
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Пересечение отрезка (x1,y1)-(x2,y2) с окружностью */
function segHitsCircle(
  x1: number, y1: number, x2: number, y2: number,
  cx: number, cy: number, r: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / lenSq : 0;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey <= r * r;
}

export class GameWorld {
  players = new Map<string, InternalPlayer>();
  bullets: InternalBullet[] = [];
  obstacles: ObstacleState[] = [];
  crateList: { id: number; x: number; y: number; opened: boolean }[] = [];
  feed: FeedItem[] = [];
  phase: GamePhase = "lobby";
  countdown = 0;
  phaseTime = 0;
  zone: ZoneInternal;
  winner: string | null = null;
  results: RoundResult[] = [];

  private feedId = 1;
  private bulletId = 1;
  private obstacleId = 1;
  private participants = new Set<string>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private hooks: EngineHooks;
  private roundNum = 0;

  constructor(hooks: EngineHooks = {}) {
    this.hooks = hooks;
    this.zone = this.freshZone();
    this.generateWorld();
  }

  // ---------- Жизненный цикл ----------

  start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(TICK_MS / 1000), TICK_MS);
    this.hooks.onLog?.("Игровой цикл запущен (50 Гц)");
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
      this.hooks.onLog?.("Игровой цикл остановлен");
    }
  }

  // ---------- Генерация мира ----------

  private freshZone(): ZoneInternal {
    const cx = WORLD_SIZE / 2;
    const cy = WORLD_SIZE / 2;
    return {
      x: cx, y: cy, r: ZONE_INITIAL_RADIUS,
      fromX: cx, fromY: cy, fromR: ZONE_INITIAL_RADIUS,
      targetX: cx, targetY: cy, targetR: ZONE_INITIAL_RADIUS,
      dps: ZONE_PHASES[0].dps,
      shrinking: false,
      phaseIndex: 0,
      stage: "hold",
      stageTime: ZONE_PHASES[0].hold,
    };
  }

  private generateWorld() {
    const solid: { x: number; y: number; r: number }[] = [];
    const place = (r: number, margin: number) => {
      for (let i = 0; i < 60; i++) {
        const x = rand(margin, WORLD_SIZE - margin);
        const y = rand(margin, WORLD_SIZE - margin);
        let ok = true;
        for (const s of solid) {
          const dx = x - s.x;
          const dy = y - s.y;
          if (dx * dx + dy * dy < (s.r + r + 24) ** 2) { ok = false; break; }
        }
        if (ok) return { x, y };
      }
      return { x: rand(margin, WORLD_SIZE - margin), y: rand(margin, WORLD_SIZE - margin) };
    };

    const add = (count: number, kind: ObstacleState["kind"], minR: number, maxR: number, margin: number, isSolid: boolean) => {
      for (let i = 0; i < count; i++) {
        const r = rand(minR, maxR);
        const p = place(r, margin);
        this.obstacles.push({ id: this.obstacleId++, kind, x: p.x, y: p.y, r });
        if (isSolid) solid.push({ x: p.x, y: p.y, r });
      }
    };

    add(26, "tree", 26, 34, 130, true);
    add(18, "rock", 22, 30, 130, true);
    add(24, "bush", 22, 30, 110, false);

    for (let i = 0; i < 14; i++) {
      const p = place(CRATE_RADIUS, 160);
      this.crateList.push({ id: i + 1, x: p.x, y: p.y, opened: false });
    }
  }

  private resetCrates() {
    for (const c of this.crateList) c.opened = false;
  }

  // ---------- Игроки ----------

  private pickColor(): string {
    const used = new Set<string>();
    for (const p of this.players.values()) used.add(p.color);
    for (const c of PLAYER_COLORS) if (!used.has(c)) return c;
    return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  }

  private uniqueName(base: string): string {
    const taken = new Set<string>();
    for (const p of this.players.values()) taken.add(p.name);
    if (!taken.has(base)) return base;
    for (let i = 2; i < 100; i++) {
      const candidate = `${base}${i}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${base}-${Math.floor(Math.random() * 1000)}`;
  }

  private randomSpawn(): { x: number; y: number } {
    for (let i = 0; i < 50; i++) {
      const x = rand(160, WORLD_SIZE - 160);
      const y = rand(160, WORLD_SIZE - 160);
      let ok = true;
      for (const o of this.obstacles) {
        if (o.kind === "bush") continue;
        const dx = x - o.x;
        const dy = y - o.y;
        if (dx * dx + dy * dy < (o.r + PLAYER_RADIUS + 10) ** 2) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
  }

  private spawnWarmup(p: InternalPlayer) {
    const pos = this.randomSpawn();
    p.x = pos.x;
    p.y = pos.y;
    p.hp = PLAYER_MAX_HP;
    p.weapon = START_WEAPON;
    p.alive = true;
    p.spectator = false;
    p.kills = 0;
    p.place = 0;
    p.cooldown = 0;
    p.input = { mx: 0, my: 0, aim: 0, shoot: false };
    // seq НЕ сбрасываем — счётчик клиента монотонный на всю сессию
  }

  join(id: string, name: string): void {
    if (this.players.has(id)) return;
    const midRound = this.phase === "playing" || this.phase === "results";
    const p: InternalPlayer = {
      id,
      name: this.uniqueName(name),
      x: WORLD_SIZE / 2,
      y: WORLD_SIZE / 2,
      angle: 0,
      hp: PLAYER_MAX_HP,
      color: this.pickColor(),
      weapon: START_WEAPON,
      alive: !midRound,
      spectator: midRound,
      kills: 0,
      place: 0,
      cooldown: 0,
      seq: 0,
      input: { mx: 0, my: 0, aim: 0, shoot: false },
    };
    if (!midRound) this.spawnWarmup(p);
    else { p.x = this.zone.x; p.y = this.zone.y; }
    this.players.set(id, p);
    this.hooks.onLog?.(`Игрок «${p.name}» вошёл (${this.players.size} всего, фаза ${this.phase})`);
  }

  leave(id: string): void {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.hooks.onLog?.(`Игрок «${p.name}» вышел`);
    if (this.phase === "playing") this.checkRoundEnd();
  }

  setInput(id: string, input: InputPayload): void {
    const p = this.players.get(id);
    if (!p) return;
    p.input.mx = clamp(input.mx, -1, 1);
    p.input.my = clamp(input.my, -1, 1);
    if (Number.isFinite(input.aim)) p.input.aim = input.aim;
    p.input.shoot = !!input.shoot;
    if (typeof input.seq === "number" && Number.isFinite(input.seq)) {
      p.seq = Math.max(p.seq, input.seq);
    }
  }

  activeCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (!p.spectator) n++;
    return n;
  }

  aliveCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (!p.spectator && p.alive) n++;
    return n;
  }

  // ---------- Основной тик ----------

  tick(dt: number) {
    switch (this.phase) {
      case "lobby": {
        if (this.activeCount() >= LOBBY_MIN_PLAYERS) {
          this.phase = "countdown";
          this.countdown = COUNTDOWN_TIME;
          this.hooks.onLog?.(`Раунд ${this.roundNum + 1}: обратный отсчёт ${COUNTDOWN_TIME}с`);
        }
        this.movePlayers(dt);
        break;
      }
      case "countdown": {
        this.countdown -= dt;
        if (this.activeCount() < LOBBY_MIN_PLAYERS) {
          this.phase = "lobby";
          this.hooks.onLog?.("Игроков стало мало — возврат в лобби");
          break;
        }
        if (this.countdown <= 0) this.startRound();
        this.movePlayers(dt);
        break;
      }
      case "playing": {
        this.updateZone(dt);
        this.movePlayers(dt);
        this.handleShooting(dt);
        this.updateBullets(dt);
        this.handleCrates();
        this.applyZoneDamage(dt);
        this.checkRoundEnd();
        break;
      }
      case "results": {
        this.phaseTime -= dt;
        if (this.phaseTime <= 0) this.resetToLobby();
        break;
      }
    }
  }

  // ---------- Фазы ----------

  private startRound() {
    this.roundNum++;
    this.participants = new Set<string>();
    for (const p of this.players.values()) {
      if (p.spectator) continue;
      this.participants.add(p.id);
      const pos = this.randomSpawn();
      p.x = pos.x;
      p.y = pos.y;
      p.hp = PLAYER_MAX_HP;
      p.weapon = START_WEAPON;
      p.alive = true;
      p.kills = 0;
      p.place = 0;
      p.cooldown = 0;
    }
    this.bullets = [];
    this.feed = [];
    this.resetCrates();
    this.winner = null;
    this.results = [];
    this.zone = this.freshZone();
    this.phase = "playing";
    this.hooks.onLog?.(`Раунд ${this.roundNum} начался (${this.participants.size} участников)`);
  }

  private resetToLobby() {
    for (const p of this.players.values()) this.spawnWarmup(p);
    this.bullets = [];
    this.feed = [];
    this.resetCrates();
    this.winner = null;
    this.results = [];
    this.zone = this.freshZone();
    this.phase = "lobby";
    this.hooks.onLog?.("Все вернулись в лобби (разминка)");
  }

  private updateZone(dt: number) {
    const z = this.zone;
    if (z.stage === "done") return;
    const phase = ZONE_PHASES[z.phaseIndex];
    z.dps = phase.dps;
    z.stageTime -= dt;

    if (z.stage === "hold") {
      z.shrinking = false;
      if (z.stageTime <= 0) {
        z.stage = "shrink";
        z.stageTime = phase.shrink;
        z.fromX = z.x;
        z.fromY = z.y;
        z.fromR = z.r;
        // Новый центр — случайная точка внутри текущего круга с запасом
        const maxOffset = Math.max(0, z.r - phase.targetRadius) * 0.8;
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * maxOffset;
        let nx = z.x + Math.cos(a) * d;
        let ny = z.y + Math.sin(a) * d;
        nx = clamp(nx, phase.targetRadius + 60, WORLD_SIZE - phase.targetRadius - 60);
        ny = clamp(ny, phase.targetRadius + 60, WORLD_SIZE - phase.targetRadius - 60);
        z.targetX = nx;
        z.targetY = ny;
        z.targetR = phase.targetRadius;
        this.hooks.onLog?.(`Зона сужается (фаза ${z.phaseIndex + 1}, dps ${phase.dps})`);
      }
    } else if (z.stage === "shrink") {
      z.shrinking = true;
      const t = 1 - Math.max(0, z.stageTime) / phase.shrink;
      z.x = lerp(z.fromX, z.targetX, t);
      z.y = lerp(z.fromY, z.targetY, t);
      z.r = lerp(z.fromR, z.targetR, t);
      if (z.stageTime <= 0) {
        z.x = z.targetX;
        z.y = z.targetY;
        z.r = z.targetR;
        z.shrinking = false;
        z.phaseIndex++;
        if (z.phaseIndex >= ZONE_PHASES.length) {
          z.stage = "done";
          z.dps = ZONE_PHASES[ZONE_PHASES.length - 1].dps;
        } else {
          z.stage = "hold";
          z.stageTime = ZONE_PHASES[z.phaseIndex].hold;
          z.targetX = z.x;
          z.targetY = z.y;
          z.targetR = z.r;
        }
      }
    }
  }

  private checkRoundEnd() {
    if (this.phase !== "playing") return;
    if (this.aliveCount() > 1) return;
    let winner: InternalPlayer | null = null;
    for (const p of this.players.values()) {
      if (!p.spectator && p.alive) { winner = p; break; }
    }
    this.endRound(winner);
  }

  private endRound(winner: InternalPlayer | null) {
    this.phase = "results";
    this.phaseTime = RESULTS_TIME;
    if (winner) {
      winner.place = 1;
      this.winner = winner.name;
    } else {
      this.winner = null;
      for (const p of this.players.values()) {
        if (!p.spectator && p.alive) p.place = 1;
      }
    }
    this.results = [];
    for (const id of this.participants) {
      const p = this.players.get(id);
      if (!p) continue;
      this.results.push({ name: p.name, kills: p.kills, win: winner ? p.id === winner.id : p.alive });
    }
    this.results.sort((a, b) => b.kills - a.kills);
    this.hooks.onLog?.(
      winner
        ? `Раунд ${this.roundNum} завершён. Победитель: ${winner.name}`
        : `Раунд ${this.roundNum} завершён. Ничья`,
    );
    this.hooks.onRoundEnd?.(this.results);
  }

  // ---------- Движение и коллизии ----------

  private movePlayers(dt: number) {
    for (const p of this.players.values()) {
      if (p.spectator) {
        // Наблюдатели «висят» в центре зоны — камера следит за штормом
        p.x = this.zone.x;
        p.y = this.zone.y;
        continue;
      }
      if (!p.alive) continue;
      p.angle = p.input.aim;
      let { mx, my } = p.input;
      const mag = Math.hypot(mx, my);
      if (mag > 1) { mx /= mag; my /= mag; }
      p.x += mx * PLAYER_SPEED * dt;
      p.y += my * PLAYER_SPEED * dt;
      // Препятствия (кусты проходимы)
      for (const o of this.obstacles) {
        if (o.kind === "bush") continue;
        const dx = p.x - o.x;
        const dy = p.y - o.y;
        const d = Math.hypot(dx, dy);
        const min = o.r + PLAYER_RADIUS;
        if (d < min && d > 0) {
          p.x = o.x + (dx / d) * min;
          p.y = o.y + (dy / d) * min;
        }
      }
      // Границы мира
      p.x = clamp(p.x, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);
      p.y = clamp(p.y, PLAYER_RADIUS, WORLD_SIZE - PLAYER_RADIUS);
    }
  }

  private handleShooting(dt: number) {
    for (const p of this.players.values()) {
      if (p.spectator || !p.alive) continue;
      p.cooldown -= dt;
      if (!p.input.shoot || p.cooldown > 0) continue;
      const spec = WEAPONS[p.weapon];
      p.cooldown = spec.cooldown;
      for (let i = 0; i < spec.pellets; i++) {
        const a = p.input.aim + rand(-spec.spread, spec.spread);
        const offset = PLAYER_RADIUS + BULLET_RADIUS + 4;
        this.bullets.push({
          id: this.bulletId++,
          ownerId: p.id,
          color: p.color,
          damage: spec.damage,
          x: p.x + Math.cos(a) * offset,
          y: p.y + Math.sin(a) * offset,
          vx: Math.cos(a) * spec.bulletSpeed,
          vy: Math.sin(a) * spec.bulletSpeed,
          life: spec.bulletLife,
        });
      }
      if (this.bullets.length > 400) this.bullets.splice(0, this.bullets.length - 400);
    }
  }

  private updateBullets(dt: number) {
    const next: InternalBullet[] = [];
    for (const b of this.bullets) {
      b.life -= dt;
      if (b.life <= 0) continue;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      // Мир
      if (nx < 0 || ny < 0 || nx > WORLD_SIZE || ny > WORLD_SIZE) continue;
      // Препятствия
      let blocked = false;
      for (const o of this.obstacles) {
        if (o.kind === "bush") continue;
        if (segHitsCircle(b.x, b.y, nx, ny, o.x, o.y, o.r)) { blocked = true; break; }
      }
      if (blocked) continue;
      // Игроки
      let hit: InternalPlayer | null = null;
      for (const p of this.players.values()) {
        if (p.spectator || !p.alive || p.id === b.ownerId) continue;
        if (segHitsCircle(b.x, b.y, nx, ny, p.x, p.y, PLAYER_RADIUS + BULLET_RADIUS)) {
          hit = p;
          break;
        }
      }
      if (hit) {
        hit.hp -= b.damage;
        if (hit.hp <= 0) {
          const owner = this.players.get(b.ownerId);
          if (owner) owner.kills++;
          this.killPlayer(hit, owner ? owner.name : "Кто-то", WEAPONS[owner ? owner.weapon : "pistol"].name);
        }
        continue;
      }
      b.x = nx;
      b.y = ny;
      next.push(b);
    }
    this.bullets = next;
  }

  private handleCrates() {
    for (const c of this.crateList) {
      if (c.opened) continue;
      for (const p of this.players.values()) {
        if (p.spectator || !p.alive) continue;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        if (dx * dx + dy * dy < (PLAYER_RADIUS + CRATE_RADIUS + 2) ** 2) {
          c.opened = true;
          if (Math.random() < 0.2) {
            p.hp = Math.min(PLAYER_MAX_HP, p.hp + 50);
            this.pushFeed("pickup", "", p.name, "+50 HP");
          } else {
            const weapons: WeaponId[] = ["smg", "shotgun", "sniper"];
            const w = weapons[Math.floor(Math.random() * weapons.length)];
            p.weapon = w;
            this.pushFeed("pickup", "", p.name, WEAPONS[w].name);
          }
          break;
        }
      }
    }
  }

  private applyZoneDamage(dt: number) {
    const z = this.zone;
    for (const p of this.players.values()) {
      if (p.spectator || !p.alive) continue;
      const dx = p.x - z.x;
      const dy = p.y - z.y;
      if (dx * dx + dy * dy > z.r * z.r) {
        p.hp -= z.dps * dt;
        if (p.hp <= 0) this.killPlayer(p, "Зона", "шторм");
      }
    }
  }

  private killPlayer(victim: InternalPlayer, killerName: string, weaponName: string) {
    victim.alive = false;
    victim.hp = 0;
    victim.place = this.aliveCount() + 1; // считая жертву
    this.pushFeed("kill", killerName, victim.name, weaponName);
    this.hooks.onLog?.(`${killerName} выбил ${victim.name} (${weaponName})`);
  }

  private pushFeed(kind: FeedItem["kind"], killer: string, victim: string, weapon: string) {
    this.feed.push({ id: this.feedId++, kind, killer, victim, weapon });
    if (this.feed.length > 6) this.feed.shift();
  }

  // ---------- Снапшот ----------

  snapshot(): Snapshot {
    const players = [];
    for (const p of this.players.values()) {
      players.push({
        id: p.id,
        name: p.name,
        x: Math.round(p.x),
        y: Math.round(p.y),
        angle: Math.round(p.angle * 100) / 100,
        hp: Math.round(Math.max(0, p.hp)),
        color: p.color,
        weapon: p.weapon,
        alive: p.alive,
        spectator: p.spectator,
        kills: p.kills,
        place: p.place,
        seq: p.seq,
      });
    }
    const z = this.zone;
    return {
      phase: this.phase,
      phaseTime: this.currentPhaseTime(),
      zone: {
        x: Math.round(z.x),
        y: Math.round(z.y),
        r: Math.round(z.r),
        targetX: Math.round(z.targetX),
        targetY: Math.round(z.targetY),
        targetR: Math.round(z.targetR),
        dps: z.dps,
        shrinking: z.shrinking,
      },
      players,
      bullets: this.bullets.map((b) => ({
        id: b.id,
        ownerId: b.ownerId,
        color: b.color,
        x: Math.round(b.x),
        y: Math.round(b.y),
        vx: Math.round(b.vx),
        vy: Math.round(b.vy),
      })),
      crates: this.crateList.map((c) => ({ id: c.id, x: c.x, y: c.y, opened: c.opened })),
      feed: [...this.feed],
      aliveCount: this.aliveCount(),
      playersInLobby: this.activeCount(),
      winner: this.winner,
      results: this.results,
    };
  }

  private currentPhaseTime(): number {
    switch (this.phase) {
      case "countdown": return Math.max(0, Math.ceil(this.countdown));
      case "results": return Math.max(0, Math.ceil(this.phaseTime));
      case "playing": return Math.max(0, Math.ceil(this.zone.stageTime));
      default: return 0;
    }
  }
}
