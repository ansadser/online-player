# Online Player

A clean VLC-style browser video player for local media, direct URLs and HLS streams.

## Features

- Local video/audio file playback
- Direct remote media URL playback
- HLS `.m3u8` streams with hls.js
- HLS multi-audio track selection
- SRT subtitles converted to WebVTT locally
- WebVTT subtitle support
- Playback speed, volume, seeking and fullscreen
- Picture-in-Picture
- Responsive desktop/mobile UI
- 8-bit and browser-supported 10-bit playback without server transcoding

## Browser limitation

The player uses the browser's own media decoder, so exact support varies by browser, OS, codec profile, bit depth and hardware. VLC desktop can decode formats that a browser cannot. HLS streams also need suitable CORS headers.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Ready for Vercel as a standard Next.js app.

## Privacy

Local files are played in the browser and are not uploaded by this app. Remote URLs are requested directly by the browser.
