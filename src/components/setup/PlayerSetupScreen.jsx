import { useMemo, useState } from 'react';
import { COLORS, HEX } from '../../Engine';

export default function PlayerSetupScreen({ playerCount, onBack, onStart }) {
  const initialColors = ['cyan', 'yellow', 'green', 'red'].slice(0, playerCount);
  const [players, setPlayers] = useState(() =>
    Array.from({ length: playerCount }, (_, index) => ({
      name: '',
      color: initialColors[index],
    }))
  );

  const usedColors = useMemo(() => players.map((player) => player.color), [players]);
  const updatePlayer = (index, field, value) => {
    setPlayers((current) => current.map((player, i) =>
      i === index ? { ...player, [field]: value } : player
    ));
  };

  const changeColor = (index, color) => {
    setPlayers((current) => {
      if (current.some((player, i) => i !== index && player.color === color)) return current;
      return current.map((player, i) => i === index ? { ...player, color } : player);
    });
  };

  const valid = players.every((player) => player.name.trim());

  return (
    <main className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-4 sm:p-8">
      <section className="w-full max-w-3xl">
        <button onClick={onBack} className="text-stone-400 hover:text-white mb-6">← Back</button>
        <div className="text-center mb-8">
          <p className="text-amber-400 uppercase tracking-widest text-xs">Game setup</p>
          <h1 className="text-3xl sm:text-4xl font-black mt-2">Meet the players</h1>
          <p className="text-stone-400 mt-2">Choose a name and a different color for every player.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {players.map((player, index) => (
            <article key={index} className="rounded-xl border border-stone-700 bg-stone-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Player {index + 1}</h2>
                <span className="w-8 h-8 rounded-full border-2 border-white/60"
                  style={{ backgroundColor: HEX[player.color] }} />
              </div>
              <label className="block text-sm text-stone-300 mb-2" htmlFor={`player-name-${index}`}>Player name</label>
              <input id={`player-name-${index}`} value={player.name}
                onChange={(event) => updatePlayer(index, 'name', event.target.value)}
                maxLength={18} placeholder={`Enter player ${index + 1} name`}
                className="w-full rounded-lg bg-stone-950 border border-stone-600 px-3 py-2 text-white outline-none focus:border-amber-400" />

              <p className="text-sm text-stone-300 mt-4 mb-2">Choose color</p>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => {
                  const taken = usedColors.includes(color) && player.color !== color;
                  return (
                    <button type="button" key={color} disabled={taken}
                      onClick={() => changeColor(index, color)}
                      title={taken ? `${color} is already selected` : color}
                      aria-label={`${color}${player.color === color ? ', selected' : ''}`}
                      className={`w-10 h-10 rounded-full border-2 transition-transform ${player.color === color ? 'border-white scale-110 ring-2 ring-amber-400' : 'border-white/20'} ${taken ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110'}`}
                      style={{ backgroundColor: HEX[color] }} />
                  );
                })}
              </div>
              <p className="text-xs text-stone-500 mt-2 capitalize">Selected: {player.color}</p>
            </article>
          ))}
        </div>

        <button disabled={!valid} onClick={() => onStart(players.map((player) => ({
          ...player, name: player.name.trim(),
        })))}
          className="w-full mt-7 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 font-black text-lg">
          Start game
        </button>
        {!valid && <p className="text-center text-xs text-stone-500 mt-2">Enter a name for every selected player to continue.</p>}
      </section>
    </main>
  );
}
