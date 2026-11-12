export default function PlayerCountScreen({ onSelect, hasSavedGame, onContinue }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-7 p-6 text-center bg-stone-900 text-stone-100">
      <div>
        <p className="text-amber-400 uppercase tracking-[0.35em] text-sm mb-3">Traditional board game</p>
        <h1 className="text-6xl sm:text-7xl font-black tracking-wide">Chaupat</h1>
        <p className="text-stone-400 mt-3">Choose how many players will join.</p>
      </div>
      {hasSavedGame && (
        <button onClick={onContinue} className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-lg font-semibold">
          Continue saved game
        </button>
      )}
      <div className="flex gap-3">
        {[2, 3, 4].map((count) => (
          <button key={count} onClick={() => onSelect(count)}
            className="w-16 h-16 rounded-xl bg-amber-600 hover:bg-amber-500 text-2xl font-black focus:outline focus:outline-2 focus:outline-white">
            {count}
          </button>
        ))}
      </div>
    </main>
  );
}
