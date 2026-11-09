/**
 * Общие типы и константы игры BUBBLE BATTLE (клиент + сервер).
 * Файл чистый: без зависимостей от socket.io, Prisma или React.
 */

// ---------- Мир ----------

export const WORLD_SIZE = 2400;
export const PLAYER_RADIUS = 20;
export const PLAYER_MAX_HP = 100;
export const PLAYER_SPEED = 185;
export const BULLET_RADIUS = 5;
export const CRATE_RADIUS = 18;

// ---------- Оружие ----------

export type WeaponId = "pistol" | "smg" | "shotgun" | "sniper";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  damage: number;
  cooldown: number; // секунд между выстрелами
  bulletSpeed: number;
  spread: number; // разброс в радианах
  pellets: number; // пуль за выстрел
  bulletLife: number; // секунд жизни пули
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: "pistol",
    name: "Пистолет",
    damage: 14,
    cooldown: 0.42,
    bulletSpeed: 520,
    spread: 0.035,
    pellets: 1,
    bulletLife: 0.9,
  },
  smg: {
    id: "smg",
    name: "Автомат",
    damage: 8,
    cooldown: 0.13,
    bulletSpeed: 560,
    spread: 0.1,
    pellets: 1,
    bulletLife: 0.8,
  },
  shotgun: {
    id: "shotgun",
    name: "Дробовик",
    damage: 8,
    cooldown: 0.95,
    bulletSpeed: 460,
    spread: 0.3,
    pellets: 6,
    bulletLife: 0.38,
  },
  sniper: {
    id: "sniper",
    name: "Снайперка",
    damage: 48,
    cooldown: 1.25,
    bulletSpeed: 950,
    spread: 0.006,
    pellets: 1,
    bulletLife: 1.1,
  },
};

export const START_WEAPON: WeaponId = "pistol";

// ---------- Зона ----------

export interface ZonePhase {
  hold: number; // секунд до начала сужения
  shrink: number; // секунд сужения
  targetRadius: number;
  dps: number; // урон в секунду вне зоны
}

export const ZONE_INITIAL_RADIUS = 1650;
export const ZONE_PHASES: ZonePhase[] = [
  { hold: 18, shrink: 14, targetRadius: 1150, dps: 2 },
  { hold: 14, shrink: 12, targetRadius: 740, dps: 4 },
  { hold: 12, shrink: 10, targetRadius: 430, dps: 7 },
  { hold: 10, shrink: 9, targetRadius: 190, dps: 10 },
  { hold: 8, shrink: 8, targetRadius: 60, dps: 14 },
];

// ---------- Раунд ----------

export const LOBBY_MIN_PLAYERS = 2;
export const COUNTDOWN_TIME = 5;
export const RESULTS_TIME = 9;

export const PLAYER_COLORS = [
  "#FFB5BA", // розовый
  "#FFD59E", // персик
  "#FFF3A3", // лимон
  "#B5EAD7", // мята
  "#C7CEEA", // лаванда
  "#E2C2F5", // сирень
  "#FFC8DD", // лепесток
  "#F4E1C1", // песок
  "#C9E4C9", // фисташка
  "#FAD2E1", // пудра
  "#F6C6EA", // орхидея
  "#D4E7F1", // небо
];

// ---------- Сущности на проводе ----------

export interface PlayerState {
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
  place: number; // 0 = ещё играет / не участвует
  seq: number; // номер последнего применённого пакета ввода
}

export interface BulletState {
  id: number;
  ownerId: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface CrateState {
  id: number;
  x: number;
  y: number;
  opened: boolean;
}

export interface ObstacleState {
  id: number;
  kind: "tree" | "rock" | "bush";
  x: number;
  y: number;
  r: number;
}

export interface FeedItem {
  id: number;
  kind: "kill" | "pickup";
  killer: string; // для pickup — пусто
  victim: string; // для pickup — кто подобрал
  weapon: string; // оружие или "+50 HP"
}

export interface ZoneState {
  x: number;
  y: number;
  r: number;
  targetX: number;
  targetY: number;
  targetR: number;
  dps: number;
  shrinking: boolean;
}

export type GamePhase = "lobby" | "countdown" | "playing" | "results";

export interface RoundResult {
  name: string;
  kills: number;
  win: boolean;
}

export interface Snapshot {
  phase: GamePhase;
  /** Остаток секунд текущего шага (обратный отсчёт / пауза зоны / до лобби) */
  phaseTime: number;
  zone: ZoneState;
  players: PlayerState[];
  bullets: BulletState[];
  crates: CrateState[];
  feed: FeedItem[];
  aliveCount: number;
  playersInLobby: number;
  winner: string | null;
  results: RoundResult[];
}

export interface InputPayload {
  mx: number; // -1..1
  my: number; // -1..1
  aim: number; // угол прицела в радианах
  shoot: boolean;
  seq?: number; // номер пакета для клиентской реконсиляции
}
