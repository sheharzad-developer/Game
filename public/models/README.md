# Character models

Drop GLTF binary files here to replace the procedural placeholder meshes:

- `soldier.glb` → the player
- `zombie.glb` → the enemies

They load automatically — no code changes needed. If a file is missing or
fails to load, the game falls back to the built-in procedural mesh.

Models should face **+X** at rest and be roughly **1.5 units tall** (the player
capsule is ~1.6 units). Scale/orientation can be tuned in
`app/components/models.jsx`.

Free CC0 sources: Quaternius, Kenney, Poly Pizza, Sketchfab (CC0 filter).
