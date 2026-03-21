# Quick Doc Formatter Mode Music Contract

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
    { "title": "Lo-Fi Flow", "file": "smooth/lofi-flow.mp3", "artist": "CC Artist", "duration": "2:41" },
    { "title": "Remote Stream", "url": "https://cdn.example.org/audio/focus-loop.mp3" }
  ],
  "focus": [
    "focus/minimal-loop.mp3"
  ]
}
```

## Notes
- Supports local files (`file`) and direct media URLs (`url` or `link`).
- YouTube page links (`youtube.com/watch`, `youtu.be/...`) are rejected; use direct media files only.
- Player automatically advances to the next track when a track ends.
- Playback is manual only (no autoplay).
- Verify licensing before adding tracks.

