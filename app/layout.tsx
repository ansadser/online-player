import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Online Player — VLC-style Web Video Player",
  description: "A clean browser video player for local files, direct URLs, HLS streams, subtitles and audio tracks.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}