export const COLORS = ['yellow', 'green', 'cyan', 'red'];
export const HEX = {
  yellow: '#eab308',
  green: '#22c55e',
  cyan: '#06b6d4',
  red: '#ef4444',
};

export const SEATS = {
  2: ['yellow', 'cyan'],
  3: ['yellow', 'green', 'cyan'],
  4: COLORS,
};

const OFF = { yellow: 0, green: 4, cyan: 8, red: 12 };
const ENTRY = { yellow: 2, green: 0, cyan: 6, red: 4 };
const LAPS_NEEDED = 3;
const SCORE = { 0: 4, 1: 1, 2: 2, 3: 3, 4: 8 };

export const RING = [
  [0, 2], [0, 1], [0, 0], [1, 0],
  [2, 0], [3, 0], [4, 0], [4, 1],
  [4, 2], [4, 3], [4, 4], [3, 4],
  [2, 4], [1, 4], [0, 4], [0, 3],
];

export const INNER = [
  [1, 1], [1, 2], [1, 3], [2, 3],
  [3, 3], [3, 2], [3, 1], [2, 1],
];

export const CENTER = [2, 2];

const key = (cell) => cell.join(',');
const SAFE = new Set(
  [0, 4, 8, 12].map((i) => key(RING[i])).concat(key(CENTER))
);

export const isSafe = (cell) => SAFE.has(key(cell));
export const isYard = (troop) => troop.p === 0 && troop.inner === 0;
export const cur = (state) => state.players[state.turn];

const say = (state, message) => {
  state.log.unshift(message);
  state.log.length = Math.min(state.log.length, 10);
};

export function cellOf(color, troop) {
  if (troop.inner === 9) return CENTER;
  if (troop.inner > 0) {
    return INNER[(ENTRY[color] + troop.inner - 1) % 8];
  }
  return RING[(OFF[color] + troop.p) % 16];
}

export function newGame(numberOfPlayers, playerConfigs = null) {
  const configs = playerConfigs?.length
    ? playerConfigs
    : SEATS[numberOfPlayers].map((color, index) => ({ color, name: `Player ${index + 1}` }));

  if (configs.length !== numberOfPlayers) {
    throw new Error('Player configuration does not match the selected player count.');
  }
  const selectedColors = configs.map((player) => player.color);
  if (new Set(selectedColors).size !== selectedColors.length ||
      selectedColors.some((color) => !COLORS.includes(color))) {
    throw new Error('Each player must have a unique valid color.');
  }

  return {
    players: configs.map((config, index) => ({
      color: config.color,
      name: config.name?.trim() || `Player ${index + 1}`,
      laps: 0,
      kills: 0, // kill events (used for the inner-grid rule)
      moved: 0, // total blocks walked by this player's troops
      deaths: 0, // times one of this player's troops was killed
      killedBy: {}, // victim color -> troops killed by this player
      finished: false,
      rank: null,
      troops: [0, 1, 2, 3].map((id) => ({
        id,
        p: 0,
        inner: 0,
        pair: null,
      })),
    })),
    turn: 0,
    phase: 'roll',
    pool: [],
    streak: [],
    extra: 0,
    coins: [false, false, false, false],
    last: null,
    nextPair: 1,
    winner: null, // first place color
    over: false, // true once only one player is left unfinished
    finishOrder: [],
    log: ['Game started'],
  };
}

// Walk a troop by n points. Entering the inner path requires
// three completed laps OR at least one successful kill.
function walk(player, troop, numberOfSteps) {
  let { p, inner } = troop;
  let laps = 0;

  for (let i = 0; i < numberOfSteps; i++) {
    if (inner > 0) {
      inner++;
      if (inner > 9) return null;
    } else if (
      p % 16 === 15 &&
      (player.laps + laps >= LAPS_NEEDED || player.kills > 0)
    ) {
      inner = 1;
    } else {
      p++;
      if (p % 16 === 15) laps++;
    }
  }

  return { p, inner, laps };
}

export function legalMoves(state, points) {
  const player = cur(state);
  const moves = [];
  const live = player.troops.filter((troop) => troop.inner !== 9);

  const yard = live.filter(
    (troop) => !troop.pair && isYard(troop)
  );

  const pairIds = [
    ...new Set(
      live
        .filter((troop) => troop.pair != null)
        .map((troop) => troop.pair)
    ),
  ];

  const add = (ids, steps, kind) => {
    if (walk(player, player.troops[ids[0]], steps)) {
      moves.push({ ids, n: steps, kind });
    }
  };

  // Move a single troop out of the house.
  if (yard[0]) add([yard[0].id], points, 'single');

  // Deploy two troops together from the house on an even roll.
  if (yard.length >= 2 && points % 2 === 0) {
    add([yard[0].id, yard[1].id], points / 2, 'deploy2');
  }

  // Move individual troops.
  live
    .filter((troop) => !troop.pair && !isYard(troop))
    .forEach((troop) => add([troop.id], points, 'single'));

  // Two separate friendly troops on a safe square can deliberately
  // form a double by choosing this move. They are NOT paired on landing.
  if (points % 2 === 0) {
    const groups = {};

    live
      .filter((troop) => !troop.pair && !isYard(troop))
      .forEach((troop) => {
        const cell = cellOf(player.color, troop);
        if (!isSafe(cell)) return;

        const cellKey = key(cell);
        (groups[cellKey] ||= []).push(troop.id);
      });

    Object.values(groups).forEach((ids) => {
      if (ids.length >= 2) {
        add(ids.slice(0, 2), points / 2, 'formPair');
      }
    });
  }

  // Existing doubles can only move on even points.
  if (points % 2 === 0) {
    pairIds.forEach((pairId) => {
      const ids = live
        .filter((troop) => troop.pair === pairId)
        .map((troop) => troop.id);

      if (ids.length === 2) {
        add(ids, points / 2, 'pair');
      }
    });
  }

  return moves;
}

// Pass the turn to the next player who has not finished yet.
function endTurn(state) {
  state.pool = [];
  state.extra = 0;
  state.streak = [];

  let next = state.turn;
  for (let i = 0; i < state.players.length; i++) {
    next = (next + 1) % state.players.length;
    if (!state.players[next].finished) break;
  }

  state.turn = next;
  state.phase = 'roll';
}

function settle(state) {
  const player = cur(state);

  // A player finishes when ALL four troops are in the center.
  // The game keeps going until only one player is left (the loser).
  if (!player.finished && player.troops.every((troop) => troop.inner === 9)) {
    player.finished = true;
    player.rank = state.finishOrder.length + 1;
    state.finishOrder.push(player.color);
    if (!state.winner) state.winner = player.color;
    state.pool = [];
    state.extra = 0;
    say(state, `${player.color} finished in place ${player.rank}!`);

    const remaining = state.players.filter((p) => !p.finished);
    if (remaining.length <= 1) {
      remaining.forEach((p) => {
        p.finished = true;
        p.rank = state.finishOrder.length + 1;
        state.finishOrder.push(p.color);
        say(state, `${p.color} is the last player left and loses`);
      });
      state.over = true;
      state.phase = 'over';
      say(state, 'Game over!');
      return state;
    }

    endTurn(state);
    return state;
  }

  if (state.pool.some((points) => legalMoves(state, points).length > 0)) {
    state.phase = 'move';
    return state;
  }

  if (state.pool.length) {
    say(state, `${player.color} has no legal move for the remaining points`);
  }

  state.pool = [];

  if (state.extra > 0) {
    state.extra--;
    state.streak = [];
    state.phase = 'roll';
    say(state, `${player.color} gets another turn`);
  } else {
    endTurn(state);
  }

  return state;
}

export function roll(state) {
  if (state.phase !== 'roll' || state.over) return state;

  const next = structuredClone(state);
  const player = cur(next);

  next.coins = Array.from({ length: 4 }, () => Math.random() < 0.5);
  const points = SCORE[next.coins.filter(Boolean).length];

  next.last = points;
  say(next, `${player.color} tossed ${points}`);

  if (points === 4 || points === 8) {
    next.streak.push(points);
    const lastThree = next.streak.slice(-3);

    if (lastThree.length === 3 && lastThree.every((value) => value === points)) {
      say(
        next,
        `${player.color} got ${points} three times in a row: the points and turn are lost`
      );
      endTurn(next);
      return next;
    }

    next.pool.push(points);
    next.phase = 'roll';
    return next;
  }

  next.streak = [];
  next.pool.push(points);
  return settle(next);
}

// Return the square occupied after each individual step.
// The UI uses this to animate a troop block-by-block before committing the move,
// and its last step is the destination highlighted on hover.
export function movePath(state, move) {
  const player = cur(state);
  const movingTroops = move.ids.map((id) => ({
    id,
    troop: { ...player.troops[id] },
    laps: 0,
  }));

  const steps = [];

  for (let step = 0; step < move.n; step++) {
    const positions = {};

    movingTroops.forEach((entry) => {
      const troop = entry.troop;

      if (troop.inner > 0) {
        troop.inner++;
      } else if (
        troop.p % 16 === 15 &&
        (player.laps + entry.laps >= LAPS_NEEDED || player.kills > 0)
      ) {
        troop.inner = 1;
      } else {
        troop.p++;
        if (troop.p % 16 === 15) entry.laps++;
      }

      positions[`${player.color}-${entry.id}`] = cellOf(player.color, troop);
    });

    steps.push(positions);
  }

  return steps;
}

function land(state, move) {
  const player = cur(state);
  const first = player.troops[move.ids[0]];

  // The center is not a kill square.
  if (first.inner === 9) {
    say(state, `${player.color} reached the center`);
    return;
  }

  const landingCell = cellOf(player.color, first);
  const isDouble =
    move.ids.length === 2 &&
    first.pair != null &&
    player.troops[move.ids[1]].pair === first.pair;

  const troopsHere = (otherPlayer) =>
    otherPlayer.troops.filter(
      (troop) =>
        !isYard(troop) &&
        troop.inner !== 9 &&
        key(cellOf(otherPlayer.color, troop)) === key(landingCell)
    );

  if (isSafe(landingCell)) return;

  let killed = 0;

  state.players.forEach((opponent, index) => {
    if (index === state.turn) return;

    troopsHere(opponent).forEach((enemy) => {
      // A single troop cannot kill either member of a double.
      if (enemy.pair != null && !isDouble) return;

      enemy.p = 0;
      enemy.inner = 0;
      enemy.pair = null;
      killed++;

      player.killedBy[opponent.color] = (player.killedBy[opponent.color] || 0) + 1;
      opponent.deaths++;
    });
  });

  if (killed > 0) {
    player.kills++;
    state.extra += killed;
    say(
      state,
      `${player.color} killed ${killed} troop(s) and earned ${killed} extra turn(s)`
    );
  }
}

export function applyMove(state, move, points) {
  if (state.phase !== 'move' || state.over) return state;

  const next = structuredClone(state);
  const player = cur(next);
  let lapsCompleted = 0;
  let reachedCenter = 0;

  move.ids.forEach((id, index) => {
    const troop = player.troops[id];
    const wasAtCenter = troop.inner === 9;
    const result = walk(player, troop, move.n);

    if (!result) return;

    if (index === 0) lapsCompleted = result.laps;
    Object.assign(troop, { p: result.p, inner: result.inner });
    player.moved += move.n;

    if (!wasAtCenter && result.inner === 9) reachedCenter++;
  });

  player.laps += lapsCompleted;

  if (move.kind === 'deploy2' || move.kind === 'formPair') {
    const pairId = next.nextPair++;

    move.ids.forEach((id) => {
      player.troops[id].pair = pairId;
    });

    say(
      next,
      move.kind === 'deploy2'
        ? `${player.color} deployed a double`
        : `${player.color} formed a double`
    );
  }

  // Each troop newly reaching the center grants one extra turn.
  if (reachedCenter > 0) {
    next.extra += reachedCenter;
    say(
      next,
      `${player.color} brought ${reachedCenter} troop(s) into the center and earned ${reachedCenter} extra turn(s)`
    );
  }

  const poolIndex = next.pool.indexOf(points);
  if (poolIndex !== -1) next.pool.splice(poolIndex, 1);

  land(next, move);
  return settle(next);
}

// Splitting is a free action: it does not consume points or change phase.
// Only the current player's doubles on safe squares can be split.
export function splittable(state) {
  const player = cur(state);

  return [
    ...new Set(
      player.troops
        .filter(
          (troop) =>
            troop.pair != null &&
            troop.inner !== 9 &&
            isSafe(cellOf(player.color, troop))
        )
        .map((troop) => troop.pair)
    ),
  ];
}

export function split(state, pairId) {
  const allowedPairs = splittable(state);
  if (!allowedPairs.includes(pairId)) return state;

  const next = structuredClone(state);
  const player = cur(next);

  player.troops.forEach((troop) => {
    if (troop.pair === pairId) troop.pair = null;
  });

  say(next, `${player.color} split a double`);
  return next;
}