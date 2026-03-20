# NotesForge Mode Music Contract

Place copyright-free audio files in this folder and map them in `manifest.json`.

## Supported modes
- `smooth`
- `calming`
- `energetic`
- `gaming`
- `vibing`
- `focus`

## Manifest format
```json
{
  "smooth": [
    { "title": "Lo-Fi Flow", "file": "smooth/lofi-flow.mp3", "artist": "CC Artist", "duration": "2:41" }
  ],
  "focus": [
    "focus/minimal-loop.mp3"
  ]
}
```

## Notes
- Use local files only (relative to `/music`).
- Playback is manual only (no autoplay).
- Verify licensing before adding tracks.
