import { useEffect, useState } from "react";
import type { WavesAt } from "./waveData";

const OFF: WavesAt = { view: null, note: null, reach: null };

/**
 * The Waves field at the hour the map shows, while the field is on: the
 * nearest frame's wave height. Off, it reads nothing and imports nothing: the
 * reading is a chunk of its own (src/waveData.ts).
 */
export function useWaves(enabled: boolean, time: number | null): WavesAt {
  const [state, setState] = useState<WavesAt>(OFF);
  const at = enabled && time !== null && Number.isFinite(time) ? time : null;
  useEffect(() => {
    if (at === null) {
      setState(OFF);
      return;
    }
    let live = true;
    import("./waveData")
      .then(({ wavesAt }) => wavesAt(at))
      .then((next) => {
        if (live) setState(next);
      })
      .catch(() => {
        if (live)
          setState({
            view: null,
            note: "Waves are unavailable just now.",
            reach: null,
          });
      });
    return () => {
      live = false;
    };
  }, [at]);
  return at === null ? OFF : state;
}

/** How long a page that is never idle waits before asking anyway. */
const IDLE_TIMEOUT_MS = 4000;
/** Where there is no idle callback: about when the first paint has settled. */
const FALLBACK_MS = 1500;

/**
 * Whether there is a wave map to offer a Waves chip for: false until it is
 * known. Asked once, after the page has loaded and gone idle, so the first
 * paint fetches nothing for it; the answer is the served run's, which lists
 * its frames only when it publishes them.
 */
export function useWavesPublished(): boolean {
  const [published, setPublished] = useState(false);
  useEffect(() => {
    let live = true;
    let idle: number | null = null;
    let timer: number | null = null;
    const ask = () => {
      import("./waveData")
        .then(({ wavesPublished }) => wavesPublished())
        .then((yes) => {
          if (live) setPublished(yes);
        })
        .catch(() => undefined);
    };
    const later = () => {
      if (!live) return;
      if (typeof window.requestIdleCallback === "function")
        idle = window.requestIdleCallback(ask, { timeout: IDLE_TIMEOUT_MS });
      else timer = window.setTimeout(ask, FALLBACK_MS);
    };
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return () => {
      live = false;
      window.removeEventListener("load", later);
      if (idle !== null) window.cancelIdleCallback(idle);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);
  return published;
}
