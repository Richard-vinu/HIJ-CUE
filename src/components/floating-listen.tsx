"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { LANDING_SONGS } from "@/lib/landing-songs";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YtPlayer }) => void;
            onStateChange?: (e: { data: number; target: YtPlayer }) => void;
          };
        }
      ) => YtPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YtPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
};

function loadYoutubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => resolve();
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prior?.();
      done();
    };
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    } else {
      const poll = window.setInterval(() => {
        if (window.YT?.Player) {
          window.clearInterval(poll);
          done();
        }
      }, 50);
    }
  });
}

/** Floating audio-only listen control (bottom-right). Video stays hidden. */
export function FloatingListen() {
  const song = LANDING_SONGS[0];
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!song || !hostRef.current) return;
    let cancelled = false;

    loadYoutubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(hostRef.current, {
        height: 1,
        width: 1,
        videoId: song.id,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
          onStateChange: (e) => {
            const YT = window.YT;
            if (!YT) return;
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
            if (
              e.data === YT.PlayerState.PAUSED ||
              e.data === YT.PlayerState.ENDED
            ) {
              setPlaying(false);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [song]);

  if (!song) return null;

  function toggle() {
    const player = playerRef.current;
    if (!player || !ready) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  }

  return (
    <>
      {/* Off-screen YouTube host — audio only, no visible video */}
      <div
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
      >
        <div ref={hostRef} />
      </div>

      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-2 md:right-6 md:bottom-6">
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          title={playing ? `Pause ${song.title}` : `Play ${song.title}`}
          aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
          className={cn(
            "inline-flex items-center gap-2.5 rounded-full bg-[#101729] py-2.5 pr-4 pl-2.5 text-white shadow-[0_10px_28px_rgba(16,23,41,0.35)] transition-all hover:opacity-95 disabled:opacity-60 dark:bg-white dark:text-[#101729] dark:shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
          )}
        >
          <span className="grid size-9 place-items-center rounded-full bg-white/15 dark:bg-[#101729]/10">
            {playing ? (
              <PauseIcon className="size-4 fill-current" />
            ) : (
              <PlayIcon className="size-4 fill-current" />
            )}
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-[13px] font-medium leading-tight tracking-[-0.01em]">
              {playing ? "Pause" : "Play"}
            </span>
            <span className="block max-w-[7.5rem] truncate font-mono text-[10px] leading-tight opacity-70">
              {song.title}
            </span>
          </span>
        </button>
      </div>
    </>
  );
}
