# Game — Top-Down Zombie Survival Shooter

A browser-based, wave-survival shooter built with **Next.js 16** and the HTML5 Canvas. Play a lone soldier holding off escalating waves of zombies — aim with the mouse, move with the keyboard, and survive as long as you can.

## Gameplay

- Zombies spawn from the screen edges in waves and chase the player.
- Each wave grows larger and faster (`5 + wave * 3` zombies, +12% speed per wave).
- Survive a wave to earn a short breather before the next one begins.
- Score scales with the current wave; the run ends when your health hits zero.

## Controls

| Action | Keys |
| ------ | ---- |
| Move   | `W` `A` `S` `D` **or** Arrow keys |
| Aim    | Mouse |
| Shoot  | Left mouse button (hold to auto-fire) |
| Reload | `R` |

Magazine holds 30 rounds with a 2-second reload; reserve ammo is shown in the HUD.

## Getting Started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

### Production build

```bash
npm run build
npm start
```

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- React 19
- HTML5 Canvas 2D rendering — all game logic and rendering live in [`app/page.js`](app/page.js)

## Troubleshooting

**`Turbopack is not supported on this platform` / `@next/swc-darwin-arm64` fails to load**

The native SWC binary may be truncated or corrupted (common when the project lives on an external drive). Repair it with a clean reinstall:

```bash
rm -rf node_modules/@next/swc-darwin-arm64
npm install
```

If the binary keeps corrupting, run the dev server on Webpack instead:

```bash
next dev --webpack
```
