import { isYard } from '../../Engine';
import { PANEL_BG } from '../../utils/gameHelpers';
import { FinishedStats } from './GameOver';

const moveLabel = (m) => {
  const t = m.ids.map((id) => id + 1).join(' & ');
  const what =
    m.kind === 'deploy2' ? `Deploy double (troops ${t})`
    : m.kind === 'formPair' ? `Form double (troops ${t})`
    : m.kind === 'pair' ? `Move double (troops ${t})`
    : `Move troop ${t}`;
  return `${what} · ${m.n} block${m.n > 1 ? 's' : ''}`;
};

export default function PlayerPanel({ color, flip, player, total, active, busy, winner, phase, pool, selected, moves, splits, onToss, onPick, onMove, onHover, onSplit, onMenu }) {
  const live = active && !winner;
  const canToss = live && phase === 'roll' && !busy;
  const canMove = live && !busy;

  return (
    <div
      // className={`relative flex flex-col min-h-[280px] lg:min-h-0 text-stone-900 transition-opacity ${player ? '' : 'opacity-30'} ${live ? 'panel-active' : ''}`}
className={`relative flex flex-col min-h-[280px] md:min-h-0 min-w-0 overflow-hidden text-stone-900 transition-opacity ${player ? '' : 'opacity-30'} ${live ? 'panel-active' : ''}`}

      style={{ background: PANEL_BG[color] }}
    >
      {/* <div className={`flex-1 flex flex-col gap-3 p-3 ${flip ? 'lg:rotate-180' : ''}`}> */}
      <div className={`flex-1 min-h-0 flex flex-col gap-2 p-2 md:overflow-y-auto md:overscroll-contain ${flip ? 'lg:rotate-180' : ''}`}>
        {!player ? (
          <p className="m-auto text-sm">Empty seat</p>
        ) : player.finished ? (
          <FinishedStats player={player} total={total} />
        ) : (
          <>
            <div className="font-bold capitalize text-lg">
              {player.name || color}
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

            {/* <button
              disabled={!canToss}
              onClick={onToss}
              className="mt-auto py-3 rounded bg-stone-800 text-amber-300 font-bold text-lg hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
            > */}
            <button
  disabled={!canToss}
  onClick={onToss}
  className="mt-auto md:sticky md:bottom-0 md:shrink-0 py-3 rounded bg-stone-800 text-amber-300 font-bold text-lg hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
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

