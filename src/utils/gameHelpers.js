import { INNER } from '../Engine';

export const SAVE_KEY = 'chaupat-save-v2';

export const X =
  'linear-gradient(to top right, transparent calc(50% - 1px), #57534e 50%, transparent calc(50% + 1px)), linear-gradient(to bottom right, transparent calc(50% - 1px), #57534e 50%, transparent calc(50% + 1px))';
export const HOME = { '0,2': 'yellow', '2,0': 'green', '4,2': 'cyan', '2,4': 'red' };
export const CENTER_COLORS =
  'conic-gradient(from -45deg, #eab308 0deg 90deg, #ef4444 90deg 180deg, #06b6d4 180deg 270deg, #22c55e 270deg 360deg)';
export const innerSet = new Set(INNER.map((cell) => cell.join(',')));
export const PANEL_BG = { yellow: '#facc15', green: '#4ade80', red: '#f87171', cyan: '#67e8f9' };

export const ordinal = (n) => ['1st', '2nd', '3rd', '4th'][n - 1] || `${n}th`;
export const killTotal = (p) => Object.values(p.killedBy || {}).reduce((a, b) => a + b, 0);
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function tokenSpot(index, n) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const size = Math.min(32, 88 / cols - 3, 88 / rows - 3);
  const row = Math.floor(index / cols);
  const col = index % cols;
  const inRow = row === rows - 1 ? n - (rows - 1) * cols : cols;
  const cx = ((col + (cols - inRow) / 2 + 0.5) / cols) * 100;
  const cy = ((row + 0.5) / rows) * 100;
  return { size, left: `${cx - size / 2}%`, top: `${cy - size / 2}%` };
}

export function centerSpot(color, index, count) {
  const size = 16, gap = 2, edge = 4;
  const start = 50 - (count * size + (count - 1) * gap) / 2;
  const along = `${start + index * (size + gap)}%`;
  if (color === 'yellow') return { left: along, top: `${edge}%` };
  if (color === 'cyan') return { left: along, top: `${100 - edge - size}%` };
  if (color === 'green') return { left: `${edge}%`, top: along };
  return { left: `${100 - edge - size}%`, top: along };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.g?.players?.length) return null;
    data.g.players = data.g.players.map((player, index) => ({
      ...player,
      name: player.name || `Player ${index + 1}`,
    }));
    return data;
  } catch {
    return null;
  }
}
