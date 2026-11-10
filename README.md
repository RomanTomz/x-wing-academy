# X-Wing Academy

A retro arcade space shooter that sneaks in UK Year 2 maths. Made by a dad for his six-year-old.

Fly a four-winged starfighter, line up on the enemy fighter carrying the right answer, and blast it. A wrong target just flashes its shields and Mission Control gives a hint. There are no lives, no timers and no game-over screen.

## Quick start

Requires Node 20+.

```bash
./play             # installs dependencies on first run, starts the game and opens your browser
```

Or with npm directly:

```bash
npm install
npm start          # starts the game and opens http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm start` | Start the game and open it in the browser |
| `npm run dev` | Start the dev server with hot reload (no browser) |
| `npm run build` | Type-check and build a static site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |
| `npm test` | Run the Vitest unit tests |
| `npm run check` | Type-check, test and build in one go |

`dist/` is fully static (relative paths, fonts bundled), so you can open it from any static host or a USB stick served with `npm run preview`.

## How to play

| Action | Keyboard | Mouse | Gamepad (PlayStation / Xbox) |
| --- | --- | --- | --- |
| Fly | Arrows or WASD | Hold the button: the ship follows the pointer | Left stick / D-pad |
| Shoot | Space (hold for auto-fire) | Hold the button | Cross / A, or R2 |
| Hear the question again | R | Speaker icon | Triangle / Y |
| Pause | P or Esc | Pause icon | Options / Start |
| Menus | Arrows + Space/Enter | Click | D-pad + Cross |

The game also pauses itself when the browser window loses focus.

### Choose your side: two careers

On the title screen, pick **REBELS** or **EMPIRE**. Each side has its own map, four planets, boss battles and a final boss, and they practise different Year 2 maths. The game remembers the last side chosen, and you can switch any time.

Each planet practises one Year 2 skill and has its own scenery, weather and music. The pilot picks a planet, then a level: **Cadet**, **Pilot** or **Ace**. Each level won earns a ⭐ for that planet, up to 3.

**Rebels (Galaxy Map)**: fly an X-wing, Y-wing or B-wing against TIE fighters.

| Planet | Skill | Cadet | Pilot | Ace |
| --- | --- | --- | --- | --- |
| Training Moon | Number bonds | to 10 | to 20 | to 100 (tens) |
| Frost Planet | Adding & taking away | within 10 | within 20 | within 100 |
| Dune World | Missing numbers | within 10 | within 20 | within 100 |
| Forest Moon | Counting patterns | 1s, 2s, 10s | 2s, 5s, 10s | 3s too, and backwards |

**Empire (Imperial Map)**: fly a TIE fighter. X-wings carry the answers.

| Planet | Skill | Cadet | Pilot | Ace |
| --- | --- | --- | --- | --- |
| TIE Academy | Comparing with < = > (`47 ? 74`, `70 + 9 ? 97` at Ace) | to 20 | to 50 | to 100 |
| Jedha | Tens and ones (base-ten blocks, `47 = 40 + ?`) | teen numbers | to 50 | to 100 |
| Yavin 4 | Odd and even ("Shoot the EVEN number!") | to 20 | to 50 | to 100 |
| Scarif | Halves and quarters | doubles, ½ | ½ and ¼ | ½, ¼, ¾ and ⅓ |

- Planets **unlock one by one** within each side. Winning any level of a planet opens the next one, so nobody gets stuck, and the stars give a reason to go back for the harder levels.
- Within a planet level, difficulty still adjusts gently, but it never leaves that level and doesn't affect Quick Mission difficulty.
- Parents can open every planet at once, and with adaptive difficulty off, only the chosen level can be played.

**Quick Mission** on the title screen is the original mixed-practice mission in open space, flown for whichever side was chosen last. It uses the parent's topic choices and the adaptive ladder.

### Boss battles

A mid-career boss sits on the route between the first two planets and opens once the planet before it has been won. It never blocks the next planet. Each career ends with a **final boss** after its last planet. Final bosses mix every skill of that career, start at the top of the chosen level, and end with one decisive question: the right answer fires a torpedo.

| Boss | Side | Opens after | Maths | How it plays |
| --- | --- | --- | --- | --- |
| **Star Destroyer** | Rebels | Training Moon | × and ÷ for 2, 5 and 10 | Fly over its deck. Turbolaser turrets rise carrying answers, and 7 hits bring it down |
| **Death Star** (final) | Rebels | Forest Moon | Everything, plus × and ÷; last question is two-step (`12 + 5 − 3`) | Skim the surface: a cannon on each side and a TIE fighter in the middle carry the answers. Then dive into the trench and hit the right exhaust port with the proton torpedo |
| **Hoth Shield Generator** | Empire | TIE Academy | < = >, tens & ones, halves, odd & even | Over the snow towards the generator dome. Its defence turrets carry the answers |
| **Rebel Flagship** (final) | Empire | Scarif | Everything, plus × and ÷; last question is tens and ones | A cannon on each side and an X-wing in the middle. The last question puts three shield domes on the hull, and the right one takes the torpedo |

Bosses fire slow bolts that only nudge your ship, so there's still no way to lose. Beating a boss (any level) wins a prize: **Destroyer Hunter** paint, **Hyperspace Streak** engines (Death Star), **Ion Blue** lasers (Hoth) and **Dark Lord Black** paint (Flagship).

### Choosing a starfighter

In the **Hangar**, the tabs at the top switch between the Rebel ship and the TIE. Each side keeps its own ship, paint and lasers, and the two share engines and the droid.

- **Rebels**: **X-Wing** (quick, four alternating cannons), **Y-Wing** (big blasts) or **B-Wing** (three cannons at once).
- **Empire**: **TIE Fighter** (quick, twin cannons), **TIE Interceptor** (fastest, wingtip cannons), **TIE Bomber** (slow, huge blasts) or **TIE Advanced** (three cannons at once). TIEs start in Imperial Grey with green lasers.

Every ship is free from the start, and every paint job works on every ship. The ships are original pixel art inspired by those silhouettes.

### A mission

1. **Briefing**: Mission Control introduces the mission. Each planet has its own briefing, and Quick Missions rotate through five.
2. **Combat**: about 10 questions (5, 10 or 15, set by a parent). Each one sends in three enemy fighters with big numbered plates. A gold lock-on bracket shows which fighter you're lined up with.
   - Right answer: explosion, +100 XP, praise from Mission Control and a cheer from the droid. The other fighters retreat.
   - Wrong answer: its shields flash and that fighter retreats, leaving fewer targets to choose from. The first hint says "too big" or "too small". After a second miss you get a strategy hint, e.g. "Start at 7 and count on 5 more". Nothing is taken away.
3. **Interludes**: short flying breaks between questions. In the crystal run, crystals are worth +10 XP. In the debris field you dodge or blast whatever is falling (+5 XP each): rocks and icebergs over planets, space junk such as broken panels, wings, droid heads and cargo crates out in space. Getting bumped costs nothing.
4. **Debrief**: targets found, first-shot accuracy, crystals, XP tally, rank progress, a promotion when earned, and a reward reveal.

### Progression (deterministic, no grinding)

- **Ranks** by total XP: Recruit → Wingmate (1,000) → Flight Officer → Sky Captain → Flight Lieutenant → Wing Commander → Star Captain → Galaxy Hero (20,000). A typical 10-question mission earns about 1,200–1,300 XP.
- **Rewards**: one per mission for the first ten missions, given in a fixed order:
  1 BIP-8 droid buddy · 2 Blaze Orange paint · 3 Twin Ion White engines · 4 Nova Blue · 5 Rainbow engines · 6 Nebula Purple · 7 Golden lasers · 8 Forest Moon Green · 9 Comet Fire engines · 10 Gold Leader paint.
- Rewards are equipped in the **Hangar**.

There are no loot boxes, streaks, timers, adverts or rankings against other children.

## Parent settings

Click **⚙ Parents** (bottom-right of the title screen) and answer the grown-up multiplication question. From there you can:

- Change the pilot name.
- Turn adaptive difficulty on or off, and choose a level: Rookie, Pilot or Squadron Leader. With adaptive on, the level you pick is the starting point. With it off, the game stays inside that level.
- Switch individual maths topics on or off.
- Set the mission length to 5, 10 or 15 questions.
- Adjust music and sound-effect volume, mute, and turn speech on or off.
- See progress: questions answered, correct first time, shots per question, accuracy by topic, recent answers and a difficulty-over-time chart.
- Reset progress. This takes two taps and keeps your settings.

Everything is saved in the browser's `localStorage`. Nothing is sent anywhere.

## The maths

| Level | Stages (max number) | Topics |
| --- | --- | --- |
| Rookie | 5 → 7 → 10 | Number recognition (number words), addition, subtraction, number bonds to 5/10 |
| Pilot | 13 → 16 → 20 | Addition and subtraction within 20, bonds to 20, missing numbers (`? + 5 = 12`, `14 − ? = 6`) |
| Squadron Leader | 30 → 60 → 100 | Addition and subtraction within 100, counting in 2s/5s/10s, 2×/5×/10× tables, two-step (`12 + 5 − 3`) |

- **Wrong options are believable.** They come from common mistakes: off-by-one, the wrong operation (7+5 → 2), a ten out (27 vs 37), reversed digits (12/21), taking the smaller digit from the bigger in subtraction (42−17 → 35), and one group too many or too few in multiplication. They are always whole numbers, never negative, never duplicated, and the correct answer appears exactly once.
- **Adaptive difficulty** moves one stage at a time. It goes up after 4 of the last 5 questions are right first time, with at least 4 questions on the current stage. It goes down after 3 of the last 4 are missed first time. Promotions get a cheerful message. Step-downs happen silently.
- **Speech**: if the browser supports it, questions, hints and briefings are read aloud (an en-GB voice is preferred). It's optional and never holds up play.

## Project layout

```
src/
  main.ts                 Bootstrap: fonts, Phaser config, audio unlock
  core/                   Constants and shared services (store, audio, speech)
  education/              PURE maths logic: generator, distractors, stages, difficulty, seedable RNG
  progression/            PURE mission state machine, campaign (planets, unlocking), XP and ranks, unlock table
  persistence/            PURE save schema, validation and migration, GameStore (localStorage)
  settings/               PURE parent settings model and sanitising
  audio/                  Web Audio synth SFX and music, SpeechSynthesis wrapper
  input/                  Keyboard + mouse + Gamepad API → game actions
  art/                    Procedural pixel art (PixelGrid rasteriser), tileable planet terrain, themes
  entities/               Player, Enemy, Droid
  scenes/                 Boot, Menu, GalaxyMap, Briefing, Mission (+ Interlude, mission/bosses/*), Pause, Complete, Hangar
  ui/                     HUD, buttons and menu navigation, effects, starfield, parent panel (HTML)
tests/                    Vitest: questions, difficulty, progression and XP, storage, campaign, Empire career and ships, bosses
```

The folders marked PURE never import Phaser, so they run in Node and are fully unit-tested. Randomness comes from an injectable seeded RNG.

All art is generated at start-up from code: ships are drawn as polygons onto a low-resolution grid, outlined, and scaled up with nearest-neighbour filtering. All sound is synthesised with Web Audio. The fonts are Press Start 2P and Fredoka, both under the SIL Open Font License and bundled via `@fontsource`. No external or copyrighted assets are used.

### Robustness notes

- A saved game is validated field by field on load. Corrupt JSON falls back to the last good backup, then to defaults. Locked rewards can't be equipped by editing storage.
- Each question can only be resolved once. A phase gate, per-enemy state and laser removal on first contact stop double-processing when several lasers land in the same frame.
- The three answers sit in fixed lanes and only sway inside them, so their labels never overlap.
- Audio starts only after a click or key press. Every audio and speech call is guarded, so the game runs fine without sound.
- Phaser reuses scene objects, so every scene resets its state in `create()` and removes its global listeners on shutdown.

## Roadmap

Ideas for future missions (not built yet):

0. **More boss battles with new Year 2 topics**: AT-AT walkers (money, flying a snowspeeder), a time-telling chase, and Empire bosses for 2D/3D shapes, measurement, and tally charts & pictograms.
0. **More planets**: Cloud City (×2/×5/×10) and more worlds for each side.
1. **Battle station phonics infiltration**: sneak through corridors by blasting the right letter sounds and blends.
2. **Jedi logic training**: lightsaber-deflect patterns, sequences and odd-one-out puzzles.
3. **Asteroid navigation geometry**: steer through shape gates and match 2D/3D shapes.
4. **Two-player co-op**: a second pilot on a gamepad as wingmate, with shared targets.
5. **Full gamepad polish**: button glyphs per controller and rumble on hits.
6. More maths: time, money, fractions (½, ¼), and greater than / less than duels.
7. Parent extras: export progress as CSV, and topic focus mode.

## Disclaimer

An unofficial, non-commercial fan project made for a child. It is not affiliated with or endorsed by Lucasfilm or Disney. All artwork and sound in this repository are original and generated by code.
