# 💬 2srt2ass

Merge two SRT subtitle files into a single dual-language **ASS** file — entirely in the
browser. A web reimplementation of
[2srt2ass-cpp](https://github.com/mcourteaux/2srt2ass-cpp) by Martijn Courteaux,
with a live preview on top.

One subtitle track renders at the bottom of the screen (usually the original language),
the other at the top (usually your translation). The generated `.ass` plays in VLC, mpv,
Kodi, Plex, Jellyfin and anything else that understands Advanced SubStation Alpha.

## ⭐ Features

Everything the CLI does:

- 🔄 Character-encoding detection and conversion (UTF-8/16 BOM sniffing, strict UTF-8
  probe, Windows-125x / ISO-8859 / CJK override list) — no iconv needed
- ⏱️ Manual per-track time shifting
- 🦺 Manual synchronization by declaring two cues to be the same line
- 🪄 Automatic time synchronization — same alignment-distance search as the original,
  upgraded to a coarse+fine scan over ±30 s
- 🖊️ `<i>`, `<b>`, `<u>` and `<font color>` converted to ASS override tags
  (including the `{\b1}` fix for the original's `<b>` → `{\b0}` bug)

And because it's a browser now:

- 🖥️ Fullscreen drag-and-drop — drop one or two files anywhere on the page
- 👁️ Live styled preview with timeline scrubbing, play and cue-to-cue jumping
- 🎬 Drop a local video (MP4/WebM everywhere, MKV in Chromium) to preview and
  play the subtitles over the real thing — the file never leaves your machine
- 🎨 Per-track styling: font, size, colors, outline width, opaque box mode
- 📄 WebVTT input support and single-file SRT → ASS conversion
- 🔒 100% client-side: static site, zero upload, zero tracking

## 🔨 Development

Requires Node ≥ 22 (built on Node 26).

```sh
npm install
npm run dev      # dev server on :4321
npm test         # vitest unit tests for the subtitle engine
npm run check    # astro + typescript typecheck
npm run build    # static production build in dist/
```

Stack: [Astro](https://astro.build) static shell + one [Preact](https://preactjs.com)
island, TypeScript everywhere. The subtitle engine in `src/lib/` is pure,
dependency-free TypeScript: `srt.ts` (lenient SRT/VTT parser), `ass.ts` (ASS
serializer), `sync.ts` (alignment search), `encoding.ts` (charset handling).

## ⚖️ License

MIT — same as the original tool.
