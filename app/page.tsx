"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Captions, ChevronDown, FileVideo, Film, Gauge, Headphones, Link2,
  Maximize, Menu, Pause, PictureInPicture2, Play, RotateCcw, Settings,
  Volume2, VolumeX, X
} from "lucide-react";

type AudioTrack = { id: number; name?: string; lang?: string; groupId?: string };
type SubtitleTrack = { id: number; name?: string; lang?: string };

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "00:00";
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = Math.floor(n % 60);
  return h ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${m}:${String(s).padStart(2,"0")}`;
};

function srtToVtt(text: string) {
  const body = text.replace(/^\\uFEFF/, "").replace(/\\r/g, "").replace(/\\n{3,}/g, "\n\n");
  return "WEBVTT\\n\\n" + body
    .replace(/^(\\d+)\\n(?=\\d{2}:)/gm, "")
    .replace(/(\\d{2}:\\d{2}:\\d{2}),(\\d{3})/g, "$1.$2");
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceKind, setSourceKind] = useState<"local"|"url"|"hls">("local");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");
  const [subtitleName, setSubtitleName] = useState("");
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [activeAudio, setActiveAudio] = useState(-1);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [menu, setMenu] = useState<"settings"|"audio"|"subtitle"|"speed"|null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const video = videoRef.current;

  const cleanup = () => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  };

  const playSource = async (src: string, name: string, kind: "local"|"url"|"hls") => {
    cleanup();
    const v = videoRef.current;
    if (!v) return;
    setError(""); setSourceName(name); setSourceKind(kind); setCurrent(0); setDuration(0);
    setAudioTracks([]); setActiveAudio(-1); setSubtitleTracks([]); setActiveSubtitle(-1); setPlaying(false);

    if (kind === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          setAudioTracks((data.audioTracks || []).map((t: any) => ({ id: t.id, name: t.name, lang: t.lang, groupId: t.groupId })));
        });
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e, data) => setActiveAudio(data.id));
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, data) => {
          setSubtitleTracks((data.subtitleTracks || []).map((t: any) => ({ id: t.id, name: t.name, lang: t.lang })));
        });
        hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_e, data) => setActiveSubtitle(data.id));
        hls.on(Hls.Events.SUBTITLE_TRACK_LOADED, () => syncNativeSubtitleTracks());
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError("This stream could not be decoded by the browser. Check the URL, CORS, or codec.");
        });
        hls.loadSource(src);
        hls.attachMedia(v);
      } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = src;
      } else {
        setError("This browser does not support HLS playback.");
        return;
      }
    } else {
      v.src = src;
    }
    try { await v.play(); } catch {}
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTrack = () => syncNativeSubtitleTracks();
    v.textTracks.addEventListener?.("addtrack", onTrack);
    return () => v.textTracks.removeEventListener?.("addtrack", onTrack);
  }, []);

  useEffect(() => () => cleanup(), []);

  const localVideo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    playSource(URL.createObjectURL(file), file.name, "local");
  };

  const subtitleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const vtt = file.name.toLowerCase().endsWith(".srt") ? srtToVtt(text) : text;
    if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
    const blobUrl = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
    setSubtitleUrl(blobUrl); setSubtitleName(file.name);
  };

  const loadUrl = () => {
    const clean = url.trim();
    if (!clean) return;
    let isHls = /\\.m3u8(?:$|[?#])/i.test(clean);
    try {
      const parsed = new URL(clean);
      // Some streaming servers expose HLS manifests through extensionless /stream/... URLs.
      isHls = isHls || /\\/stream(?:\\/|$)/i.test(parsed.pathname);
    } catch {}
    playSource(clean, clean.split("/").pop()?.split("?")[0] || "Stream", isHls ? "hls" : "url");
  };

  const seek = (value: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(value)) return;
    v.currentTime = value;
    setCurrent(value);
    setSeekPreview(null);
  };
  const seekPreviewValue = seekPreview ?? current;
  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v || (!v.src && !hlsRef.current)) return;
    if (v.paused) await v.play(); else v.pause();
  };
  const setSpeed = (n: number) => { setRate(n); if (videoRef.current) videoRef.current.playbackRate = n; setMenu(null); };
  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture();
  };
  const fullscreen = async () => {
    const el = document.querySelector(".player-shell") as HTMLElement | null;
    if (!el) return;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen();
      else {
        const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        v?.webkitEnterFullscreen?.();
      }
    } else {
      await document.exitFullscreen();
    }
  };
  const selectAudio = (id: number) => {
    const hls = hlsRef.current;
    if (hls) { hls.audioTrack = id; setActiveAudio(id); }
    setMenu(null);
  };
  const syncNativeSubtitleTracks = () => {
    const tracks = videoRef.current?.textTracks;
    if (!tracks) return;
    const items = Array.from(tracks).map((t, id) => ({ id, name: t.label || (t.kind === "captions" ? "Captions" : "Subtitles"), lang: t.language }));
    if (items.length) setSubtitleTracks(items);
  };
  const selectSubtitle = (id: number) => {
    const hls = hlsRef.current;
    const v = videoRef.current;
    if (hls) {
      hls.subtitleTrack = id;
      setActiveSubtitle(id);
    } else if (v) {
      Array.from(v.textTracks).forEach((track, index) => { track.mode = index === id ? "showing" : "disabled"; });
      setActiveSubtitle(id);
    }
    setMenu(null);
  };
  const disableSubtitle = () => {
    const hls = hlsRef.current;
    const v = videoRef.current;
    if (hls) hls.subtitleTrack = -1;
    if (v) Array.from(v.textTracks).forEach(track => { track.mode = "disabled"; });
    setActiveSubtitle(-1);
    setMenu(null);
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Play size={18} fill="currentColor"/></div><span>ONLINE<span>PLAYER</span></span></div>
        <nav className={mobileOpen ? "nav open" : "nav"}>
          <button onClick={() => urlInputRef.current?.focus()}>Stream URL</button>
          <button onClick={() => setShowHelp(true)}>Supported media</button>
        </nav>
        <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X/> : <Menu/>}</button>
      </header>

      <section className="hero">
        <div className="eyebrow"><span/> CLEAN VLC-STYLE WEB PLAYER</div>
        <h1>Play your media.<br/><em>Your way.</em></h1>
        <p>Local video, direct URLs, HLS streams, subtitles and audio tracks — in one clean player.</p>
        <div className="source-box">
          <div className="source-tabs"><button className="active"><Link2 size={16}/> Stream URL</button><label><FileVideo size={16}/> Open file<input type="file" accept="video/*,audio/*,.mkv,.ts,.m2ts,.webm,.mp4,.mov,.m4v" onChange={localVideo}/></label></div>
          <div className="url-row">
            <input ref={urlInputRef} value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadUrl()} placeholder="Paste a video URL or .m3u8 stream URL…" />
            <button className="load-btn" onClick={loadUrl}><Play size={17} fill="currentColor"/> Play</button>
          </div>
          <div className="hint">HLS .m3u8 is supported • No upload required for remote streams</div>
        </div>
      </section>

      <section className="player-section">
        <div className="player-shell">
          <video
            ref={videoRef}
            crossOrigin="anonymous"
            onPlay={()=>{setPlaying(true);setError("")}}
            onPlaying={()=>setError("")}
            onCanPlay={()=>setError("")}
            onPause={()=>setPlaying(false)}
            onTimeUpdate={()=>{if(!isSeeking)setCurrent(videoRef.current?.currentTime||0);setError("")}}
            onLoadedMetadata={()=>{setDuration(videoRef.current?.duration||0); syncNativeSubtitleTracks();}}
            onError={(e)=>{
              const v=e.currentTarget;
              window.setTimeout(()=>{
                if (v.paused && v.readyState === 0 && v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
                  setError("This media could not be opened by the browser. Check the URL, CORS, or codec/container support.");
                }
              },400);
            }}
            onClick={togglePlay}
            playsInline
          >
            {subtitleUrl && <track key={subtitleUrl} kind="subtitles" src={subtitleUrl} label={subtitleName || "Subtitles"} default />}
          </video>

          {!sourceName && <div className="empty-player"><div className="empty-icon"><Film size={34}/></div><h2>Ready when you are</h2><p>Drop a video here, open a local file, or paste a stream URL above.</p></div>}
          {error && <div className="player-error"><strong>Playback error</strong><span>{error}</span></div>}

          <div className="controls">
            <input className="seek" type="range" min="0" max={duration||0} step="0.01" value={Math.min(seekPreviewValue,duration||0)}
              onPointerDown={()=>setIsSeeking(true)}
              onChange={e=>setSeekPreview(Number(e.target.value))}
              onPointerUp={e=>{setIsSeeking(false);seek(Number((e.target as HTMLInputElement).value))}}
              onKeyUp={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) seek(Number((e.target as HTMLInputElement).value))}}/>
            <div className="control-row">
              <div className="left-controls">
                <button onClick={togglePlay} aria-label="Play/Pause">{playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button>
                <button className="time" onClick={()=>seek(0)}><span>{fmt(current)}</span> / <span>{fmt(duration)}</span></button>
                <button onClick={()=>{setMuted(!muted);if(videoRef.current)videoRef.current.muted=!muted}}>{muted||volume===0?<VolumeX/>:<Volume2/>}</button>
                <input className="volume" type="range" min="0" max="1" step=".01" value={muted?0:volume} onChange={e=>{const n=Number(e.target.value);setVolume(n);setMuted(n===0);if(videoRef.current){videoRef.current.volume=n;videoRef.current.muted=n===0}}}/>
              </div>
              <div className="right-controls">
                <button onClick={()=>setMenu(menu==="subtitle"?null:"subtitle")} title="Subtitles"><Captions/></button>
                {audioTracks.length>0 && <button onClick={()=>setMenu(menu==="audio"?null:"audio")} title="Audio tracks"><Headphones/></button>}
                <button onClick={()=>setMenu(menu==="speed"?null:"speed")} title="Playback speed"><Gauge/></button>
                <button onClick={togglePiP} title="Picture in picture"><PictureInPicture2/></button>
                <button onClick={fullscreen} title="Fullscreen"><Maximize/></button>
              </div>
            </div>
            {menu==="speed" && <div className="menu-pop speed-pop">{[.5,.75,1,1.25,1.5,2].map(n=><button key={n} className={rate===n?"selected":""} onClick={()=>setSpeed(n)}>{n}x</button>)}</div>}
            {menu==="audio" && <div className="menu-pop"><strong>Audio tracks</strong>{audioTracks.map(t=><button key={t.id} className={activeAudio===t.id?"selected":""} onClick={()=>selectAudio(t.id)}>{t.name||t.lang||`Track ${t.id+1}`}</button>)}</div>}
            {menu==="subtitle" && <div className="menu-pop"><strong>Subtitles</strong>
              {subtitleTracks.map(t=><button key={t.id} className={activeSubtitle===t.id?"selected":""} onClick={()=>selectSubtitle(t.id)}>{t.name||t.lang||`Track ${t.id+1}`} <small>stream</small></button>)}
              {subtitleTracks.length>0 && <button onClick={disableSubtitle}>Off</button>}
              <label className="upload-sub">Add .srt / .vtt<input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" onChange={subtitleFile}/></label>
              {subtitleName&&<button className="selected" onClick={()=>setMenu(null)}>{subtitleName}</button>}
            </div>}
          </div>
        </div>

        <div className="below-player">
          <div><span className="status-dot"/>{sourceKind==="hls"?"HLS STREAM":sourceKind==="url"?"REMOTE MEDIA":sourceKind==="local"?"LOCAL MEDIA":"READY"} {sourceName && <b>· {sourceName}</b>}</div>
          <div className="capabilities"><span>8-bit</span><span>10-bit*</span><span>HLS</span><span>VTT / SRT</span><span>Multi-audio</span></div>
        </div>
        <p className="codec-note">* 8-bit and 10-bit playback depends on the browser/device decoder and the exact codec profile. The player uses the browser's native media pipeline rather than transcoding your file.</p>
      </section>

      <section className="features">
        <div><span><Link2/></span><h3>Stream by URL</h3><p>Paste direct MP4/WebM links or HLS .m3u8 streams. No server upload.</p></div>
        <div><span><Captions/></span><h3>Subtitles</h3><p>Load SRT or WebVTT files and keep subtitles local to your device.</p></div>
        <div><span><Headphones/></span><h3>Audio tracks</h3><p>Switch HLS audio renditions when the stream exposes multiple tracks.</p></div>
        <div><span><Settings/></span><h3>Player controls</h3><p>Seek, volume, speed, fullscreen and Picture-in-Picture.</p></div>
      </section>

      <footer><div className="brand"><div className="brand-mark"><Play size={15} fill="currentColor"/></div><span>ONLINE<span>PLAYER</span></span></div><small>Browser-first media playback · No upload by default</small></footer>

      {showHelp && <div className="modal-backdrop" onClick={()=>setShowHelp(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setShowHelp(false)}><X/></button><h2>Media support</h2><p>This player relies on the browser's media decoder, so exact support varies by device and browser.</p><ul><li>MP4 / WebM and common browser codecs</li><li>HLS .m3u8 via HLS.js or native HLS</li><li>8-bit and supported 10-bit profiles</li><li>SRT converted to WebVTT locally</li><li>Multiple HLS audio tracks</li></ul><p className="muted">If a VLC-only codec does not play, the browser itself needs a compatible decoder; this app does not secretly transcode your media.</p></div></div>}
    </main>
  );
}