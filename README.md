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
- 8-bit playback without server transcoding

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


## VLC-style decoder fallback

This project uses the uploaded VLC/libVLC source trees as architecture/reference material; it does **not** bundle the VLC C/C++ source.

The browser player now has a fallback path based on FFmpeg WebAssembly for media that the native browser decoder cannot open. The fallback downloads the direct media into the browser, decodes/transcodes it to an 8-bit browser-friendly H.264/AAC MP4, and then plays the result locally.

### Important

- Native playback is always attempted first.
- The FFmpeg/WASM fallback is used only after native playback fails.
- Remote fallback requires the media server to allow browser CORS requests.
- Large files can require significant RAM/CPU and can take time to transcode; this is not equivalent to real-time VLC hardware decoding.
- HLS streams continue to use hls.js/native HLS. Embedded HLS audio/subtitle tracks are handled separately.
- The FFmpeg WebAssembly core is GPL-2.0-or-later; review and satisfy applicable licensing/source-notice requirements before public redistribution.
