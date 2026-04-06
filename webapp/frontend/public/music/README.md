# NotesForge Music Guide

Place copyright-safe audio files in this folder and map them in `manifest.json`.

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
    {
      "title": "Lo-Fi Flow",
      "file": "smooth/lofi-flow.mp3",
      "artist": "CC Artist",
      "duration": "2:41"
    }
  ],
  "focus": [
    {
      "title": "Kushi Theme (Loop)",
      "file": "Kushi Theme (Instrumental)_spotdown.org.mp3"
    }
  ]
}
```

## Single-track loop setup

If a mode contains only one track, the player effectively loops that track because it advances to the next item and wraps back to the same entry.

Example:

```json
{
  "focus": [
    {
      "title": "Kushi Theme (Loop)",
      "file": "Kushi Theme (Instrumental)_spotdown.org.mp3"
    }
  ]
}
```

## Rules
- supports local files via `file`
- supports direct media URLs via `url` or `link`
- YouTube page links are rejected
- playback is manual only
- verify licensing before adding tracks
