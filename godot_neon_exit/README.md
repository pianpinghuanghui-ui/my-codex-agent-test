# Neon Exit Godot

This is a Godot 4.6 version of the same Issue #4 playable slice. It keeps the first-person roguelike horror escape loop while using only lightweight procedural geometry, simple lights, and built-in meshes.

## Run

1. Install Godot 4.6.
2. Open the `godot_neon_exit` folder as a project.
3. Run `res://scenes/main.tscn`.

No external assets, API keys, or network access are required. The project is configured for the Compatibility renderer to keep it friendlier to lower-spec PCs.

## Controls

- `WASD`: move
- Mouse: look
- `Shift`: sprint
- `E`: collect / use exit
- `Esc`: release mouse
- `R`: restart after a result screen

## Preserved Game Content

- First-person playable 3D exploration.
- Stage 1 is a Shinjuku-like night district.
- Procedural maze routing and item placement change each run.
- Narrow alleys, high-rise silhouettes, elevated rail, neon signs, shrines, and exit lantern are generated at runtime.
- Four required objectives: station pass, ward key, shrine charm, and gate fuse.
- A watcher threat chases the player and drains sanity.
- Stamina, sanity, light, danger, current objective, item count, and seed are displayed in the HUD.
- The run ends in either escape success or game over.

## Scope Safety

This Godot version lives entirely under `godot_neon_exit/` and does not modify the existing Web prototype or any existing Godot, `muminotou` / `mumminoto`, `gotbot`, or fashion files.
