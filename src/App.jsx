import { useEffect, useState } from 'react';
import {
  newGame, roll, legalMoves, applyMove, split, splittable,
  cellOf, isYard, cur, INNER, HEX, movePath,
} from './Engine';

const SAVE_KEY = 'chaupat-save-v2'; // v2: new engine state (ranks, stats)

const X =
  'linear-gradient(to top right, transparent calc(50% - 1px), #57534e 50%, transparent calc(50% + 1px)), linear-gradient(to bottom right, transparent calc(50% - 1px), #57534e 50%, transparent calc(50% + 1px))';
const HOME = { '0,2': 'yellow', '2,0': 'green', '4,2': 'cyan', '2,4': 'red' };
const CENTER_COLORS =
  'conic-gradient(from -45deg, #eab308 0deg 90deg, #ef4444 90deg 180deg, #06b6d4 180deg 270deg, #22c55e 270deg 360deg)';
const innerSet = new Set(INNER.map((cell) => cell.join(',')));
const PANEL_BG = { yellow: '#facc15', green: '#4ade80', red: '#f87171', cyan: '#67e8f9' };

const ordinal = (n) => ['1st', '2nd', '3rd', '4th'][n - 1] || `${n}th`;
const killTotal = (p) => Object.values(p.killedBy || {}).reduce((a, b) => a + b, 0);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.g?.players?.length ? data : null;
  } catch {
    return null;
  }
}

// Lay out n troops in a cell as a centered grid that shrinks as the cell fills,
// so every troop stays visible (a safe house can hold up to 16).
function tokenSpot(index, n) {
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

// Winning troops sit inside their own colored triangle of the center block.
function centerSpot(color, index, count) {
  const size = 16, gap = 2, edge = 4;
  const start = 50 - (count * size + (count - 1) * gap) / 2;
  const along = `${start + index * (size + gap)}%`;
  if (color === 'yellow') return { left: along, top: `${edge}%` };
  if (color === 'cyan') return { left: along, top: `${100 - edge - size}%` };
  if (color === 'green') return { left: `${edge}%`, top: along };
  return { left: `${100 - edge - size}%`, top: along };
}

const moveLabel = (m) => {
  const t = m.ids.map((id) => id + 1).join(' & ');
  const what =
    m.kind === 'deploy2' ? `Deploy double (troops ${t})`
    : m.kind === 'formPair' ? `Form double (troops ${t})`
    : m.kind === 'pair' ? `Move double (troops ${t})`
    : `Move troop ${t}`;
  return `${what} · ${m.n} block${m.n > 1 ? 's' : ''}`;
};

function FinishedStats({ player, total }) {
  const victims = Object.entries(player.killedBy || {});
  const lost = player.rank === total;
  return (
    <div className="flex-1 flex flex-col gap-1 bg-white/80 rounded p-3 text-sm">
      <div>Laps done: <b>{player.laps}</b></div>
      <div>Total troop movement: <b>{player.moved}</b></div>
      <div>Kills: <b>{killTotal(player)}</b></div>
      {victims.length > 0 && (
        <>
          <div className="text-xs mt-1 text-stone-600">Players killed:</div>
          {victims.map(([c, n]) => (
            <div key={c} className="flex items-center gap-2 capitalize">
              <span className="w-3 h-3 rounded-full border border-black/40" style={{ background: HEX[c] }} />
              {c}: <b>{n}</b>
            </div>
          ))}
        </>
      )}
      <div className={`mt-auto pt-3 text-center font-black uppercase tracking-wide rank-banner ${lost ? 'text-red-800' : ''}`}>
        {lost ? `${player.color} lost: ${ordinal(player.rank)} place` : `${player.color} ${ordinal(player.rank)} place${player.rank === 1 ? ' winner!!!!' : '!'}`}
      </div>
    </div>
  );
}

function StatBar({ value, max, color, delay }) {
  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <span className="font-bold">{value}</span>
      <div className="h-2 rounded bg-white/10 overflow-hidden">
        <div className="stat-bar h-full rounded" style={{ '--w': `${(value / max) * 100}%`, '--d': `${delay}s`, background: color }} />
      </div>
    </div>
  );
}

function GameOver({ g, onClose, onNew }) {
  const ranked = [...g.players].sort((a, b) => a.rank - b.rank);
  const total = g.players.length;
  const max = (f) => Math.max(1, ...g.players.map(f));
  const mx = { laps: max((p) => p.laps), moved: max((p) => p.moved), kills: max(killTotal), deaths: max((p) => p.deaths || 0) };
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 results-fade">
      <div className="w-full max-w-4xl rounded-2xl bg-stone-900 text-stone-100 shadow-2xl p-4 sm:p-6 flex flex-col gap-6">
        <h2 className="text-center text-3xl sm:text-4xl font-black tracking-wide trophy-title">🏆 Game over 🏆</h2>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm uppercase tracking-widest text-stone-400">Rankings</h3>
          {ranked.map((p, i) => {
            const lost = p.rank === total;
            return (
              <div
                key={p.color}
                className={`rank-row flex items-center gap-3 rounded-xl p-3 text-stone-900 ${p.rank === 1 ? 'rank-first' : ''}`}
                style={{ background: `linear-gradient(90deg, ${HEX[p.color]}, ${HEX[p.color]}44)`, animationDelay: `${i * 0.3}s` }}
              >
                <span className="text-3xl w-10 text-center">{lost ? '💀' : ['🥇', '🥈', '🥉'][i]}</span>
                <span className="font-black text-xl uppercase flex-1">{p.color}</span>
                {lost && <span className="px-2 py-0.5 rounded bg-black/75 text-red-300 text-xs font-bold">LOST</span>}
                <span className="font-black text-lg">{ordinal(p.rank)}</span>
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm uppercase tracking-widest text-stone-400">Stats</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-separate border-spacing-y-2">
              <thead className="text-stone-400 text-xs uppercase">
                <tr>
                  <th className="px-3">Player</th><th className="px-3">Laps</th><th className="px-3">Movement</th>
                  <th className="px-3">Kills</th><th className="px-3">Deaths</th><th className="px-3">Killed</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p, i) => {
                  const d = 1.2 + i * 0.25;
                  return (
                    <tr key={p.color} className="rank-row bg-white/5" style={{ animationDelay: `${d}s` }}>
                      <td className="px-3 py-2 rounded-l-lg font-black uppercase border-l-8" style={{ borderColor: HEX[p.color], color: HEX[p.color] }}>
                        {p.color} <span className="text-stone-400 font-normal normal-case">({ordinal(p.rank)})</span>
                      </td>
                      <td className="px-3"><StatBar value={p.laps} max={mx.laps} color={HEX[p.color]} delay={d + 0.2} /></td>
                      <td className="px-3"><StatBar value={p.moved} max={mx.moved} color={HEX[p.color]} delay={d + 0.2} /></td>
                      <td className="px-3"><StatBar value={killTotal(p)} max={mx.kills} color={HEX[p.color]} delay={d + 0.2} /></td>
                      <td className="px-3"><StatBar value={p.deaths || 0} max={mx.deaths} color={HEX[p.color]} delay={d + 0.2} /></td>
                      <td className="px-3 py-2 rounded-r-lg">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(p.killedBy || {}).map(([c, n]) => (
                            <span key={c} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10">
                              <span className="w-3 h-3 rounded-full" style={{ background: HEX[c] }} />{n}
                            </span>
                          ))}
                          {killTotal(p) === 0 && <span className="text-stone-500">-</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="px-5 py-2 rounded border border-stone-500 hover:bg-stone-700">View board</button>
          <button onClick={onNew} className="px-5 py-2 rounded bg-amber-600 hover:bg-amber-500 font-bold">New game</button>
        </div>
      </div>
    </div>
  );
}

function Coins({ toss, flip, active }) {
  const coins = toss?.coins || [null, null, null, null];
  return (
    <div className={`flex items-center justify-center gap-2 py-2 ${flip ? 'lg:rotate-180' : ''} ${active ? '' : 'opacity-60'}`}>
      {coins.map((c, i) => (
        <span
          key={i}
          className={`w-9 h-9 rounded-full grid place-items-center text-sm font-bold ${
            c === null ? 'bg-stone-300 text-stone-500' : c ? 'bg-amber-400 text-black' : 'bg-stone-600 text-white'
          }`}
        >
          {c === null ? '·' : c ? 'H' : 'T'}
        </span>
      ))}
      <span className="ml-1 text-xl text-stone-800 min-w-[3ch]">{toss ? `= ${toss.last}` : ''}</span>
    </div>
  );
}

function Panel({ color, flip, player, total, active, busy, winner, phase, pool, selected, moves, splits, onToss, onPick, onMove, onHover, onSplit, onMenu }) {
  const live = active && !winner;
  const canToss = live && phase === 'roll' && !busy;
  const canMove = live && !busy;

  return (
    <div
      className={`relative flex flex-col min-h-[280px] lg:min-h-0 text-stone-900 transition-opacity ${player ? '' : 'opacity-30'} ${live ? 'panel-active' : ''}`}
      style={{ background: PANEL_BG[color] }}
    >
      <div className={`flex-1 flex flex-col gap-3 p-3 ${flip ? 'lg:rotate-180' : ''}`}>
        {!player ? (
          <p className="m-auto text-sm">Empty seat</p>
        ) : player.finished ? (
          <FinishedStats player={player} total={total} />
        ) : (
          <>
            <div className="font-bold capitalize text-lg">
              {color}
              {live && <span className="ml-2 text-sm animate-pulse">● your turn</span>}
            </div>

            <div className="bg-white/80 rounded px-2 py-1 text-sm">
              laps {player.laps}/3, kills {player.kills}, in house {player.troops.filter(isYard).length}, center {player.troops.filter((t) => t.inner === 9).length}/4
            </div>

            {live && pool.length > 0 && (
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-sm">Points:</span>
                {pool.map((p, i) => (
                  <button
                    key={`${p}-${i}`}
                    disabled={busy}
                    onClick={() => onPick(p)}
                    className={`px-3 py-1 rounded border ${p === selected ? 'bg-stone-800 text-amber-300 border-stone-800' : 'bg-white/80 border-stone-600'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {canMove && moves.length > 0 && (
              <div className="bg-white/80 rounded p-2 flex flex-col gap-2">
                <p className="text-xs text-stone-600">Choose a troop to move:</p>
                {moves.map((m, i) => (
                  <button
                    key={`${m.kind}-${m.ids.join('-')}-${i}`}
                    onMouseEnter={() => onHover(m)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(m)}
                    onBlur={() => onHover(null)}
                    onClick={() => onMove(m)}
                    className="py-2 px-3 rounded border border-stone-500 bg-white hover:bg-stone-800 hover:text-amber-200 text-left text-sm transition-all duration-200"
                  >
                    {moveLabel(m)}
                  </button>
                ))}
              </div>
            )}

            {canMove && splits.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs">Free action, safe block:</p>
                {splits.map((id) => (
                  <button key={id} onClick={() => onSplit(id)} className="py-2 rounded border border-dashed border-stone-700 bg-white/60 text-sm">
                    Split double
                  </button>
                ))}
              </div>
            )}

            {!active && !winner && <p className="text-sm opacity-70">Waiting for your turn…</p>}

            <button
              disabled={!canToss}
              onClick={onToss}
              className="mt-auto py-3 rounded bg-stone-800 text-amber-300 font-bold text-lg hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {live && pool.length > 0 ? 'Toss again (bonus)' : 'Toss'}
            </button>
          </>
        )}
      </div>
      {onMenu && (
        <div className="p-2 flex justify-center">
          <button onClick={onMenu} disabled={busy} className="px-4 py-1 rounded bg-stone-800 text-amber-200 text-sm disabled:opacity-50">
            New game
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [init] = useState(loadSave);
  const [g, setG] = useState(init?.g ?? null);
  const [tosses, setTosses] = useState(init?.tosses ?? {});
  const [view, setView] = useState(init ? 'game' : 'menu');
  const [pick, setPick] = useState(null);
  const [hoveredTroops, setHoveredTroops] = useState([]);
  const [killCells, setKillCells] = useState([]);
  const [visualPositions, setVisualPositions] = useState({});
  const [animating, setAnimating] = useState(false);
  const [choices, setChoices] = useState(null);
  const [hoverDest, setHoverDest] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Auto-save after every committed change, so a refresh resumes the game.
  useEffect(() => {
    if (!g) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ g, tosses }));
    } catch { /* storage full or blocked: ignore */ }
  }, [g, tosses]);

  // Pop the results screen up shortly after the game ends.
  const isOver = !!g?.over;
  useEffect(() => {
    if (!isOver) return undefined;
    const t = setTimeout(() => setShowResults(true), 1200);
    return () => clearTimeout(t);
  }, [isOver]);

  const startNew = (n) => {
    if (animating) return;
    setG(newGame(n));
    setTosses({});
    setPick(null);
    setHoveredTroops([]);
    setKillCells([]);
    setVisualPositions({});
    setChoices(null);
    setHoverDest(null);
    setShowResults(false);
    setView('game');
  };

  if (view === 'menu' || !g) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center bg-stone-900 text-stone-100">
        <h1 className="text-6xl tracking-wide">Chaupat</h1>
        {g && (
          <button onClick={() => setView('game')} className="px-8 py-3 rounded bg-emerald-600 hover:bg-emerald-500 text-xl">
            Continue game
          </button>
        )}
        <p className="text-stone-400">
          {g ? 'Or start a new game (this erases the saved game):' : 'How many players?'}
        </p>
        <div className="flex gap-3">
          {[2, 3, 4].map((n) => (
            <button key={n} onClick={() => startNew(n)} className="px-6 py-3 rounded bg-amber-600 hover:bg-amber-500 text-xl focus:outline focus:outline-2 focus:outline-white">
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const player = cur(g);
  const selectedPoints = g.pool.includes(pick) ? pick : g.pool[0];
  const moves = g.phase === 'move' && selectedPoints != null ? legalMoves(g, selectedPoints) : [];
  const splits = splittable(g);

  const canClick = !g.over && !animating && g.phase === 'move' && moves.length > 0;
  const yardIds = player.troops.filter((t) => !t.pair && isYard(t)).map((t) => t.id);

  // Moves that a click on this troop could mean. Any troop in the house stands in
  // for the first one the engine lists, so clicking troop 3 moves troop 3.
  const candidatesFor = (troop) => {
    const real = player.troops[troop.id];
    if (!real.pair && isYard(real)) {
      return moves.flatMap((m) => {
        if (m.kind === 'single' && yardIds.includes(m.ids[0])) return [{ ...m, ids: [troop.id] }];
        if (m.kind === 'deploy2') {
          const other = yardIds.find((id) => id !== troop.id);
          return other === undefined ? [] : [{ ...m, ids: [troop.id, other] }];
        }
        return [];
      });
    }
    return moves.filter((m) => m.ids.includes(troop.id));
  };

  const cells = {};
  g.players.forEach((p) => {
    p.troops.forEach((troop) => {
      const cell = visualPositions[`${p.color}-${troop.id}`] || cellOf(p.color, troop);
      (cells[cell.join(',')] ||= []).push({ color: p.color, id: troop.id, pair: troop.pair });
    });
  });

  // The block a move would end on, highlighted while hovering its button or troop.
  const destOf = (m) => {
    const steps = movePath(g, m);
    const lastStep = steps[steps.length - 1];
    return lastStep?.[`${player.color}-${m.ids[0]}`]?.join(',') ?? null;
  };
  const hoverMove = (m) => {
    setHoveredTroops(m.ids);
    setHoverDest(destOf(m));
  };
  const clearHover = () => {
    setHoveredTroops([]);
    setHoverDest(null);
  };

  const handleToss = () => {
    const next = roll(g);
    if (next === g) return;
    setG(next);
    setTosses((t) => ({ ...t, [player.color]: { coins: next.coins, last: next.last } }));
  };

  const handleMove = async (move) => {
    if (animating) return;
    setAnimating(true);
    clearHover();

    for (const step of movePath(g, move)) {
      setVisualPositions((prev) => ({ ...prev, ...step }));
      await wait(340);
    }

    const next = applyMove(g, move, selectedPoints);
    const effects = [];
    g.players.forEach((other, idx) => {
      if (idx === g.turn) return;
      other.troops.forEach((troop, ti) => {
        if (!isYard(troop) && isYard(next.players[idx].troops[ti])) {
          effects.push(cellOf(other.color, troop).join(','));
        }
      });
    });

    setG(next);
    setVisualPositions({});
    setKillCells(effects);
    setAnimating(false);
    if (effects.length) window.setTimeout(() => setKillCells([]), 700);
  };

  const handleSplit = (pairId) => {
    if (animating) return;
    setG((current) => split(current, pairId));
  };

  const handleTroopClick = (troop) => {
    if (!canClick || troop.color !== player.color) return;
    const options = candidatesFor(troop);
    if (options.length === 1) {
      clearHover();
      handleMove(options[0]);
    } else if (options.length > 1) {
      setChoices(options);
    }
  };

  const cancelChoices = () => {
    setChoices(null);
    clearHover();
  };

  const panel = (color, flip, withMenu) => {
    const p = g.players.find((x) => x.color === color);
    const active = p && p.color === player.color;
    return (
      <Panel
        color={color} flip={flip} player={p} active={active}
        busy={animating} winner={g.over} total={g.players.length} phase={g.phase} pool={g.pool}
        selected={selectedPoints} moves={active ? moves : []} splits={active ? splits : []}
        onToss={handleToss} onPick={setPick} onMove={handleMove}
        onHover={(m) => (m ? hoverMove(m) : clearHover())} onSplit={handleSplit}
        onMenu={withMenu ? () => setView('menu') : null}
      />
    );
  };

  const coins = (color, flip) => {
    const p = g.players.find((x) => x.color === color);
    return p ? <Coins toss={tosses[color]} flip={flip} active={p.color === player.color && !g.over} /> : <div />;
  };

  return (
    <main className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] lg:h-screen lg:overflow-hidden bg-white">
      <div className="order-2 lg:order-none grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
        {panel('yellow', true, true)}
        {panel('green', false, false)}
      </div>

      <section className="relative order-1 lg:order-none flex flex-col items-center justify-center bg-white text-stone-900">
        <div className="grid grid-cols-2 w-full divide-x divide-stone-300">
          {coins('yellow', true)}
          {coins('red', true)}
        </div>

        <div
          className="chaupat-board grid grid-cols-5 w-[min(95vw,640px)] lg:w-[min(46vw,calc(100vh_-_190px),780px)] aspect-square shrink-0 border-2 border-stone-500 bg-stone-100 shadow-2xl"
          style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gridTemplateRows: 'repeat(5, minmax(0, 1fr))' }}
        >
          {Array.from({ length: 25 }, (_, index) => {
            const row = Math.floor(index / 5);
            const column = index % 5;
            const cellKey = `${row},${column}`;
            const homeColor = HOME[cellKey];
            const isCenter = cellKey === '2,2';

            let background = '#f5f5f4';
            let backgroundImage = 'none';
            if (isCenter) {
              background = '#fde68a';
              backgroundImage = `${X}, ${CENTER_COLORS}`;
            } else if (homeColor) {
              background = `${HEX[homeColor]}55`;
              backgroundImage = X;
            } else if (innerSet.has(cellKey)) {
              background = '#e7e5e4';
            }

            const tokens = cells[cellKey] || [];

            return (
              <div
                key={cellKey}
                className={`relative min-w-0 min-h-0 overflow-hidden border border-stone-400 flex flex-wrap items-center justify-center content-center gap-0.5 p-0.5 ${hoverDest === cellKey ? 'dest-cell' : ''}`}
                style={{ background, backgroundImage }}
              >
                {hoverDest === cellKey && <span className="absolute inset-[16%] rounded-full border-4 border-dashed border-amber-500 dest-ring pointer-events-none" />}
                {killCells.includes(cellKey) && <span className="absolute inset-0 kill-effect z-20" />}

                {tokens.map((troop, tokenIndex) => {
                  const isHovered = troop.color === player.color && hoveredTroops.includes(troop.id);
                  const stepping =
                    animating && Object.prototype.hasOwnProperty.call(visualPositions, `${troop.color}-${troop.id}`);
                  const options = canClick && troop.color === player.color ? candidatesFor(troop) : [];
                  const movable = options.length > 0;
                  const tokenStyle = {
                    background: HEX[troop.color],
                    boxShadow: troop.pair && !isCenter ? '0 0 0 2px #111, 0 0 0 4px white' : '0 1px 3px #0008',
                    zIndex: isHovered ? 10 : 1,
                    position: 'absolute',
                    transition: 'left .25s ease, top .25s ease, width .25s ease',
                    ...(movable ? { cursor: 'pointer' } : {}),
                    ...(movable && !isHovered ? { outline: '2px solid #fbbf24', outlineOffset: '1px' } : {}),
                  };

                  if (isCenter) {
                    const mates = tokens.filter((t) => t.color === troop.color);
                    Object.assign(tokenStyle, {
                      width: '16%',
                      ...centerSpot(troop.color, mates.indexOf(troop), mates.length),
                    });
                  } else {
                    const spot = tokenSpot(tokenIndex, tokens.length);
                    Object.assign(tokenStyle, { width: `${spot.size}%`, left: spot.left, top: spot.top });
                  }

                  return (
                    <span
                      key={`${troop.color}-${troop.id}`}
                      role={movable ? 'button' : undefined}
                      tabIndex={movable ? 0 : undefined}
                      onClick={movable ? () => handleTroopClick(troop) : undefined}
                      onKeyDown={movable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTroopClick(troop); } } : undefined}
                      onMouseEnter={movable ? () => { if (options.length === 1) hoverMove(options[0]); else { setHoveredTroops([troop.id]); setHoverDest(null); } } : undefined}
                      onMouseLeave={movable ? clearHover : undefined}
                      className={[
                        'troop-token flex items-center justify-center rounded-full border border-black/60 aspect-square text-[9px] sm:text-[10px] font-black text-black',
                        isHovered ? 'troop-hover' : 'troop-idle',
                        stepping ? 'troop-step' : '',
                      ].join(' ')}
                      style={tokenStyle}
                      title={`${troop.color} troop ${troop.id + 1}${troop.pair ? ' (double)' : ''}`}
                    >
                      {troop.id + 1}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="w-full px-3 py-1 text-center text-sm text-stone-600 min-h-[2.75rem] flex flex-col justify-center">
          {g.over ? (
            <span className="text-xl font-bold text-stone-900 capitalize">
              <span className="inline-block w-4 h-4 rounded-full mr-2 align-middle" style={{ background: HEX[g.finishOrder[0]] }} />
              {g.finishOrder[0]} wins!
              <button onClick={() => setShowResults(true)} className="ml-3 text-sm underline text-stone-600 normal-case font-normal">Show results</button>
            </span>
          ) : (
            g.log.slice(0, 2).map((m, i) => (
              <div key={`${m}-${i}`} className={i ? 'opacity-60' : ''}>{m}</div>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 w-full divide-x divide-stone-300">
          {coins('green', false)}
          {coins('cyan', false)}
        </div>
        {choices && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/40" onClick={cancelChoices}>
            <div className="bg-white rounded-lg p-4 shadow-xl flex flex-col gap-2 min-w-[240px]" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-stone-600">What should this troop do?</p>
              {choices.map((m, i) => (
                <button
                  key={`${m.kind}-${m.ids.join('-')}-${i}`}
                  onMouseEnter={() => hoverMove(m)}
                  onMouseLeave={clearHover}
                  onClick={() => { setChoices(null); handleMove(m); }}
                  className="py-2 px-3 rounded border border-stone-500 hover:bg-stone-800 hover:text-amber-200 text-left text-sm"
                >
                  {moveLabel(m)}
                </button>
              ))}
              <button onClick={cancelChoices} className="text-sm underline text-stone-500 self-start">Cancel</button>
            </div>
          </div>
        )}
      </section>

      <div className="order-3 lg:order-none grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
        {panel('red', true, true)}
        {panel('cyan', false, false)}
      </div>
      {g.over && showResults && (
        <GameOver
          g={g}
          onClose={() => setShowResults(false)}
          onNew={() => { setShowResults(false); setView('menu'); }}
        />
      )}
    </main>
  );
}
