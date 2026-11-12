import { HEX } from '../../Engine';
import { ordinal, killTotal } from '../../utils/gameHelpers';

export function FinishedStats({ player, total }) {
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
        {lost ? `${player.name || player.color} lost: ${ordinal(player.rank)} place` : `${player.name || player.color} ${ordinal(player.rank)} place${player.rank === 1 ? ' winner!!!!' : '!'}`}
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

export default function GameOver({ g, onClose, onNew }) {
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
                <span className="font-black text-xl uppercase flex-1">{p.name || p.color}</span>
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
                        {p.name || p.color} <span className="text-stone-400 font-normal normal-case">({ordinal(p.rank)})</span>
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

