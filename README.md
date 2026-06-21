# Neon Exit

Issue #4 implementation: a first-person roguelike horror escape prototype set in a Shinjuku-like night district.

## Run

No build step is required. Serve the repository root with any static server:

```bash
python -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

The game imports Three.js from jsDelivr, so the first run needs network access.

## Controls

- `WASD`: move
- Mouse: look around after pointer lock
- `Shift`: sprint
- `E`: interact / collect / use exit
- Touch devices: use the left movement pad, swipe the view, and use the action buttons

## Game Loop

Each run generates a new Stage 1 layout from a seed. Collect all four target items, avoid the watcher, and reach the green exit lantern. The run ends in success when the exit is used with all items, or failure when the watcher catches the player or sanity reaches zero.

## Stage Structure

Stages are registered in `src/stages.js`. Stage 1 is defined as `shinjuku-like` with its item set, procedural maze size, colors, and objective text. Future stages can be added to the `STAGES` array and selected through `getStageById`.
