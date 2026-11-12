export default function Coins({ toss, flip, active }) {
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

