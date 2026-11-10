# Chaupat

**Chaupat** is a free online board game for 2 to 4 players. It is similar to Ludo, but with four coins instead of a dice, "double troops" that can only be killed by other doubles, a safe-block system, and an inner grid that you only unlock by lapping the board three times or by making a kill.

Play it online: **https://chaupat-five.vercel.app**

---

## Table of contents

1. [Features](#features)
2. [Game rules](#game-rules)
3. [How to play (controls)](#how-to-play-controls)
4. [Rankings and stats](#rankings-and-stats)
5. [Tech stack](#tech-stack)
6. [Getting started](#getting-started)
7. [Project structure](#project-structure)
8. [How the game engine works](#how-the-game-engine-works)
9. [Deploying on Vercel and getting found on Google](#deploying-on-vercel-and-getting-found-on-google)
10. [Roadmap](#roadmap)

---

## Features

- 2, 3 or 4 players on one screen (hot-seat). Each player has their own colored panel, and the top two panels are rotated so people sitting on opposite sides can read them.
- Four-coin toss with bonus tosses and the "three in a row" penalty.
- Double troops: deploy together, move together, and only another double can kill them.
- Click a troop on the board, or use the move buttons in your panel. Hovering shows which block the troop will land on.
- Step-by-step move animation, kill flash, hover bounce and a pulsing highlight on the active player's panel.
- The game keeps running until only one player is left (the loser). Players who finish early show their stats.
- Animated results screen with a rank table and a stats table.
- Auto-save in the browser: refresh the page and the game resumes exactly where you left it.
- Works on desktop and mobile.

---

## Game rules

### Goal

Get all **4 of your troops** into the **center block** of the board. Players who finish are ranked 1st, 2nd, 3rd... in the order they finish. The game ends when only one player has not finished: that player loses.

### Players and troops

- Minimum 2 players, maximum 4.
- Each player has 4 numbered troops (1 to 4) of their color.
- Seats: **2 players** = yellow and cyan, **3 players** = yellow, green and cyan, **4 players** = yellow, green, cyan and red.
- Turn order goes yellow, green, cyan, red (skipping empty seats and players who have already finished).

### The board

The board is a 5x5 grid of 25 blocks. **5 blocks are crossed** (they show two diagonal lines): the middle block of each of the four sides, and the exact center of the grid.

```
 yellow home (top)
        v
 .   .   X   .   .
 .   .   .   .   .
 X   .   C   .   X     <- green home (left), center C, red home (right)
 .   .   .   .   .
 .   .   X   .   .
        ^
 cyan home (bottom)
```

- The four side-center crossed blocks are the **home blocks**. Each is the starting point and house of one player.
- Every crossed block is a **safe block**: nobody can be killed there, and any number of troops (from any players) can share it.
- The ring of 16 outer blocks is the **outer track**. The 8 blocks around the center (the 3x3 ring) form the **inner grid**.

#### Outer track layout

The outer track is numbered 0 to 15 counterclockwise, starting from yellow's home. `*` marks the home blocks.

```
 2   1   0*  15  14
 3   .   .   .   13
 4*  .   C   .   12*
 5   .   .   .   11
 6   7   8*  9   10
```

| Player | Home block (track index) |
|--------|--------------------------|
| Yellow | 0 (top middle) |
| Green | 4 (left middle) |
| Cyan | 8 (bottom middle) |
| Red | 12 (right middle) |

### Tossing the coins

Instead of a dice, **four coins are tossed together**:

| Result | Points |
|--------|--------|
| 1 head, 3 tails (H T T T) | **1** |
| 2 heads, 2 tails (H H T T) | **2** |
| 3 heads, 1 tail (H H H T) | **3** |
| 4 heads (H H H H) | **8** |
| 4 tails (T T T T) | **4** |

### Bonus tosses and the "three in a row" penalty

- Tossing **8** (all heads) or **4** (all tails) gives you **another toss**.
- If you toss the **same bonus value three times in a row** (4, 4, 4 or 8, 8, 8), **all the points you collected are wasted and your turn is over**.
- Mixed bonus values do not count as a streak. For example `4, 4, 8, 8, 4` is safe, because you never got the same bonus value three times together.

### Using points

- All the points you collect in a turn (for example `4, 3`) go into a **points pool**. Pick a point, then pick which troop uses it, and repeat until the pool is empty.
- You can spend points in any order.
- If no legal move exists for any remaining point, the leftover points are wasted and the turn passes (or you take your extra turn, if you have one).

### Movement

- Everyone moves in the same direction: **counterclockwise** around the outer track, leaving their house toward their right-hand side. Troops never move backward.
- A troop moves as many blocks as the points you spend on it.
- A troop in the house (home block) can leave with any point value.

### Laps and entering the inner grid

A player can only take troops into the inner grid after **either**:

- **completing 3 laps** of the outer track, or
- **killing at least one enemy troop**.

Details:

- A lap is counted when a troop reaches **the block just left of its own house** (the last block before returning home).
- Laps are counted for the **whole player**, not per troop. If troop 1 does one lap and dies, and troop 2 later does two laps, the player has completed 3 laps. Once qualified, **all** of the player's troops can enter the inner grid.
- Once a player is qualified, a troop that lands on or passes the block just left of its home turns into the inner grid there instead of continuing around the outer track.

### The inner grid and the center

- The inner grid is a one-way ring, followed **clockwise**. Each player enters it at a different block, and each color can only enter the center from its own side:

| Player | Enters inner ring at | Enters center from |
|--------|----------------------|--------------------|
| Yellow | top-right | top |
| Green | top-left | left |
| Cyan | bottom-left | bottom |
| Red | bottom-right | right |

- From the block left of home it is **9 steps** to the center for every color (8 inner ring blocks, then the center).
- You need an **exact roll** to land in the center. A troop whose move would overshoot the center cannot make that move, and if no other move is possible the points are wasted.
- Troops that reach the center stay there, in their own colored triangle of the center block.

### Killing

- If you **land exactly** on a block that holds an enemy troop, and that block is **not safe**, the enemy troop is **killed** and goes back to its house. Passing over a troop does nothing.
- **Safe blocks** (the home blocks and the center) never allow kills.
- Killing gives you **one extra turn per troop killed**.
- Troops in the inner grid (except the center) are on ordinary non-safe blocks, so they can be killed there as well.
- Killed troops lose their position but **laps already counted for the player stay counted**.

### Double troops

A **double** is two of your troops moving together as one unit.

**Creating a double** (only from a safe block):
- **Deploy from the house:** if you have two troops in the house and an **even** point value, you can send both out together.
- **Form from a safe block:** two single troops of yours standing on the same safe block can leave together as a double on an **even** point value.
- Two troops that simply land on the same ordinary block do **not** become a double.

**Moving a double:**
- A double only moves on **even** points, and it moves **half** the points. For example a 4 moves a double 2 blocks, and 8 moves it 4 blocks.
- **Odd points (1 and 3) cannot be used on a double.** If you only have doubles and no single troops, odd points are wasted.

**Doubles and kills:**
- A double **cannot be killed by a single troop**. If a single lands on a block with an enemy double, nothing happens and they share the block.
- A double **can only be killed by another double** landing on it on a non-safe block. Killing a double kills both troops, so the killer gets **2 extra turns**.
- A double can also kill enemy single troops.

**Splitting a double:**
- A double can be split only when it is standing on a **safe block**. Splitting is a free action and uses no points.
- It may also stay together on a safe block, whichever the player wants.

### Extra turns summary

| Event | Extra turns |
|-------|-------------|
| Toss 4 or 8 | one more toss (points are kept in the pool) |
| Kill a single troop | 1 |
| Kill a double | 2 |
| A troop newly enters the center | 1 per troop |

Extra turns from a kill or from reaching the center are used after you have spent your current points.

### Winning, ranking and the loser

- A player **finishes** when all 4 of their troops are in the center. They receive the next free rank and are skipped in later turns.
- The game ends when **only one player has not finished**. That player is ranked last and loses.
- With 2 players, the game ends the moment one player finishes. With 4 players it ends when 3 have finished.

### Quick reference of edge cases

| Situation | What happens |
|-----------|--------------|
| Roll an odd number with only doubles left | Points are wasted |
| Move would overshoot the center | Move is not allowed |
| Enemy single lands on your double | No kill, both stay |
| Enemy double lands on your double (non-safe) | Your double dies, the killer gets 2 extra turns |
| Anything lands on a safe block with other troops | Everyone shares it, no kills |
| 4,4,4 or 8,8,8 in a row | All points and the turn are lost |
| Player already qualified for the inner grid | Any troop reaching the block left of home turns inward |

---

## How to play (controls)

1. Choose the number of players on the start screen (or **Continue game** if a saved game exists).
2. On your turn, press **Toss** in your panel. Only the active player's Toss button is enabled.
3. If you tossed a 4 or an 8, toss again (the button says "Toss again (bonus)").
4. When the tossing is done, your collected points appear as chips. The highlighted chip is the one that will be used, so click a different chip to use that one first.
5. Move a troop by either:
   - clicking a **highlighted troop** on the board, or
   - clicking a button under **"Choose a troop to move"** in your panel.
6. When a troop has more than one possible move (for example move alone, or deploy/form a double), a small chooser appears.
7. **Hover** a button or a troop to see it bounce and to see the **destination block pulse**.
8. If you have a double on a safe block, a **Split double** button appears in your panel.
9. Troops are numbered 1 to 4 so you can tell them apart. Doubles are drawn with a double ring.
10. **New game** opens the menu: choose **Continue game** to go back to the saved game, or pick a player count to start fresh (this erases the saved game).

---

## Rankings and stats

When a player finishes, their panel switches to a stats summary:

```
Laps done: 5
Total troop movement: 78
Kills: 16
Players killed:
  red: 4
  yellow: 6
  green: 6

CYAN 1st place winner!!!!
```

When the game ends, an animated results screen shows:

- **Rankings table:** medals for 1st to 3rd, a skull for the loser, rows in each player's color.
- **Stats table:** laps, total movement, kills, deaths and who each player killed, with animated bars.

What the numbers mean:

| Stat | Meaning |
|------|---------|
| Laps | Laps completed by the player's troops (counted at the block left of home) |
| Movement | Total blocks walked by all the player's troops (a double moving 2 blocks counts as 4) |
| Kills | Total enemy troops killed |
| Deaths | Times one of the player's troops was killed |
| Killed | Kills broken down by victim color |

---

## Tech stack

- [React](https://react.dev/) 18
- [Vite](https://vitejs.dev/) 5
- [Tailwind CSS](https://tailwindcss.com/) 3.4
- Plain CSS keyframes for animation
- `localStorage` for saving the game
- Deployed on [Vercel](https://vercel.com/)

No backend: everything runs in the browser.

---

## Getting started

```bash
git clone https://github.com/KaranBhavsar-1/<your-repo-name>.git
cd <your-repo-name>
npm install
npm run dev        # start the dev server
npm run build      # production build in dist/
npm run preview    # preview the production build locally
```

Requires Node.js 18 or newer.

---

## Project structure

```
.
├── index.html            # page title, description, social tags, structured data
├── public/
│   ├── favicon.svg
│   ├── og-image.png      # image shown when the link is shared
│   ├── robots.txt
│   └── sitemap.xml
└── src/
    ├── main.jsx          # React entry point
    ├── App.jsx           # board, player panels, animations, results screen
    ├── engine.js         # all game rules (pure functions, no React)
    └── index.css         # Tailwind plus the animation keyframes
```

---

## How the game engine works

`src/engine.js` holds every rule as pure functions that take a game state and return a new one. That keeps the rules separate from the UI, so they can be tested or reused (for bots or online play).

Main exports:

| Function | Purpose |
|----------|---------|
| `newGame(n)` | Create a game for 2, 3 or 4 players |
| `roll(state)` | Toss the coins, handle bonus tosses and the three-in-a-row penalty |
| `legalMoves(state, points)` | List every legal move for one point value |
| `movePath(state, move)` | Block-by-block path of a move (used for animation and the hover highlight) |
| `applyMove(state, move, points)` | Apply a move, resolve kills, laps, extra turns and finishing |
| `splittable(state)` / `split(state, pairId)` | Find and split doubles standing on safe blocks |
| `cellOf(color, troop)` | Board coordinates of a troop |

Each troop stores `p` (blocks walked on the outer track, 0 means in the house), `inner` (steps on the inner path, 9 means center) and `pair` (an id shared by the two troops of a double).

Saved games are stored under the `chaupat-save-v2` key in `localStorage`.

---

## Deploying on Vercel and getting found on Google

1. Push the repo to GitHub and import it on [vercel.com/new](https://vercel.com/new). Vercel detects Vite automatically (build command `npm run build`, output `dist`).
2. Keep the site URL in `index.html`, `public/robots.txt` and `public/sitemap.xml` in sync with your live address (currently `https://chaupat-five.vercel.app`). If you add a custom domain, update it in all three.
3. Add a 1200x630 `public/og-image.png` for link previews.
4. Add your site in [Google Search Console](https://search.google.com/search-console), submit `sitemap.xml`, and use **URL inspection > Request indexing** for the home page.
5. Put the live link in your GitHub repo description and website field, and in your README, portfolio and social profiles. Links from other sites help a lot.
6. A custom domain (for example `chaupat.com`) usually ranks better than a `*.vercel.app` subdomain.

No one can guarantee a search ranking, but the title, description, structured data, sitemap and Search Console steps above give Google everything it needs to find and understand the site.

---

## Roadmap

- Online multiplayer
- Bot players
- Sound effects
- Undo-free "rules" help screen inside the game
- Unit tests for `engine.js`

---

## Author

Made by [Karan Bhavsar](https://github.com/KaranBhavsar-1).
