import { useEffect, useState } from 'react';
import {
  newGame, roll, legalMoves, applyMove, split, splittable,
  cellOf, isYard, cur, INNER, HEX, movePath,
} from './Engine';
import PlayerCountScreen from './components/setup/PlayerCountScreen';
import PlayerSetupScreen from './components/setup/PlayerSetupScreen';
import PlayerPanel from './components/game/PlayerPanel';
import Coins from './components/game/Coins';
import GameOver from './components/game/GameOver';
import {
  SAVE_KEY, X, HOME, CENTER_COLORS, innerSet, wait,
  tokenSpot, centerSpot, loadSave,
} from './utils/gameHelpers';

// Creates readable labels for the available move options.
const moveLabel = (m) => {
  const t = m.ids.map((id) => id + 1).join(' & ');

  const what =
    m.kind === 'deploy2' ? `Deploy double (troops ${t})`
    : m.kind === 'formPair' ? `Form double (troops ${t})`
    : m.kind === 'pair' ? `Move double (troops ${t})`
    : `Move troop ${t}`;

  return `${what} · ${m.n} block${m.n > 1 ? 's' : ''}`;
};

export default function App() {
  const [init] = useState(loadSave);
  const [g, setG] = useState(init?.g ?? null);
  const [tosses, setTosses] = useState(init?.tosses ?? {});
  const [view, setView] = useState(init ? 'game' : 'player-count');
  const [playerCount, setPlayerCount] = useState(4);
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

  useEffect(() => {
    if (!g || g.over || animating || g.phase !== 'move' || !g.pool.length) return;
    const available = g.pool.flatMap((points) =>
      legalMoves(g, points).map((move) => ({ move, points }))
    );
    if (available.length !== 1) return;

    const onlyMove = available[0];
    const timer = window.setTimeout(
      () => handleMove(onlyMove.move, onlyMove.points),
      350
    );
    return () => window.clearTimeout(timer);
  }, [g, animating]);
  
  const startNew = (configs) => {
    if (animating) return;
    setG(newGame(configs.length, configs));
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

  if (view === 'player-count') {
    return (
      <PlayerCountScreen
        hasSavedGame={!!g}
        onContinue={() => setView('game')}
        onSelect={(count) => { setPlayerCount(count); setView('player-setup'); }}
      />
    );
  }

  if (view === 'player-setup') {
    return (
      <PlayerSetupScreen
        playerCount={playerCount}
        onBack={() => setView('player-count')}
        onStart={startNew}
      />
    );
  }

  if (!g) {
    setView('player-count');
    return null;
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

  const handleMove = async (move, points = selectedPoints) => {
    if (animating) return;
    setAnimating(true);
    clearHover();

    for (const step of movePath(g, move)) {
      setVisualPositions((prev) => ({ ...prev, ...step }));
      await wait(340);
    }

    const next = applyMove(g, move, points);
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
      <PlayerPanel
        color={color} flip={flip} player={p} active={active}
        busy={animating} winner={g.over} total={g.players.length} phase={g.phase} pool={g.pool}
        selected={selectedPoints} moves={active ? moves : []} splits={active ? splits : []}
        onToss={handleToss} onPick={setPick} onMove={handleMove}
        onHover={(m) => (m ? hoverMove(m) : clearHover())} onSplit={handleSplit}
        onMenu={withMenu ? () => setView('player-count') : null}
      />
    );
  };

  const coins = (color, flip) => {
    const p = g.players.find((x) => x.color === color);
    return p ? <Coins toss={tosses[color]} flip={flip} active={p.color === player.color && !g.over} /> : <div />;
  };

  return (
    // <main className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] lg:h-screen lg:overflow-hidden bg-white">
    <main className="min-h-screen w-full flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:h-[100dvh] md:min-h-0 md:overflow-hidden bg-white">
      {/* <div className="order-2 lg:order-none grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2"> */}
      <div className="order-2 md:order-none grid grid-cols-2 md:grid-cols-1 md:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] min-h-0">
        {panel('yellow', true, true)}
        {panel('green', false, false)}
      </div>

      {/* <section className="relative order-1 lg:order-none flex flex-col items-center justify-center bg-white text-stone-900"> */}
      <section className="relative order-1 md:order-none flex flex-col items-center justify-center bg-white text-stone-900 md:min-w-0 md:min-h-0 md:overflow-hidden">

        <div className="grid grid-cols-2 w-full divide-x divide-stone-300">
          {coins('yellow', true)}
          {coins('red', true)}
        </div>

        <div
          // className="chaupat-board grid grid-cols-5 w-[min(95vw,640px)] lg:w-[min(46vw,calc(100vh_-_190px),780px)] aspect-square shrink-0 border-2 border-stone-500 bg-stone-100 shadow-2xl"
          className="chaupat-board grid grid-cols-5 w-[min(95vw,640px)] md:w-[min(46vw,calc(100dvh_-_190px),780px)] aspect-square shrink-0 border-2 border-stone-500 bg-stone-100 shadow-2xl"

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
              {g.players.find((p) => p.color === g.finishOrder[0])?.name || g.finishOrder[0]} wins!
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

      {/* <div className="order-3 lg:order-none grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2"> */}
      <div className="order-3 md:order-none grid grid-cols-2 md:grid-cols-1 md:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] min-h-0">
        {panel('red', true, true)}
        {panel('cyan', false, false)}
      </div>
      {g.over && showResults && (
        <GameOver
          g={g}
          onClose={() => setShowResults(false)}
          onNew={() => { setShowResults(false); setView('player-count'); }}
        />
      )}
    </main>
  );
}
