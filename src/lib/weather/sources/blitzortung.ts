/**
 * Blitzortung.org Live-Stream über öffentlichen WebSocket.
 * Strikes kommen LZW-kodiert als String, wir dekodieren clientseitig.
 * Quelle / Decoder-Referenz: Roland Wolfs Open-Source-Map-Client.
 */
import { useEffect, useRef, useState } from "react";

export interface LightningStrike {
  /** Unix-ns vom Server, wir mappen auf ms. */
  time: number;
  lat: number;
  lon: number;
}

const WS_ENDPOINTS = ["wss://ws1.blitzortung.org/", "wss://ws7.blitzortung.org/", "wss://ws8.blitzortung.org/"];
const BUFFER_MS = 60 * 60 * 1000; // 60 min im Puffer halten

/**
 * Hält einen Live-Buffer der letzten ~60 min an Blitzen,
 * optional auf eine BBox gefiltert. Pausiert bei Tab-Inaktivität.
 */
export function useLightningStream(opts: { enabled: boolean; bbox?: [number, number, number, number] }) {
  const { enabled, bbox } = opts;
  const [strikes, setStrikes] = useState<LightningStrike[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "error" | "closed">("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<LightningStrike[]>([]);
  const reconnectRef = useRef<number | null>(null);
  const flushRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      teardown();
      setStatus("idle");
      return;
    }
    let endpointIdx = 0;
    let attempt = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const url = WS_ENDPOINTS[endpointIdx % WS_ENDPOINTS.length];
      endpointIdx++;
      setStatus("connecting");
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => {
          attempt = 0;
          setStatus("open");
          // Abo-Payload, von Blitzortung-Map-Client bekannt.
          ws.send(JSON.stringify({ a: 111 }));
        };
        ws.onmessage = (evt) => {
          try {
            const raw = typeof evt.data === "string" ? evt.data : "";
            if (!raw) return;
            const json = decodeLzw(raw);
            const parsed = JSON.parse(json) as { time?: number; lat?: number; lon?: number };
            if (typeof parsed.lat !== "number" || typeof parsed.lon !== "number") return;
            const tsMs = typeof parsed.time === "number" ? Math.floor(parsed.time / 1_000_000) : Date.now();
            bufferRef.current.push({ time: tsMs, lat: parsed.lat, lon: parsed.lon });
          } catch {
            // einzelne korrupte Frames ignorieren
          }
        };
        ws.onerror = () => {
          setStatus("error");
        };
        ws.onclose = () => {
          setStatus("closed");
          if (cancelled) return;
          const delay = Math.min(30_000, 1_000 * 2 ** attempt++);
          reconnectRef.current = window.setTimeout(connect, delay);
        };
      } catch {
        setStatus("error");
      }
    };

    const flush = () => {
      const cutoff = Date.now() - BUFFER_MS;
      bufferRef.current = bufferRef.current.filter((s) => s.time >= cutoff);
      if (bbox) {
        const [w, s, e, n] = bbox;
        setStrikes(bufferRef.current.filter((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n));
      } else {
        setStrikes([...bufferRef.current]);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wsRef.current?.close();
      } else if (!wsRef.current || wsRef.current.readyState >= 2) {
        connect();
      }
    };

    connect();
    flushRef.current = window.setInterval(flush, 2_000);
    document.addEventListener("visibilitychange", onVisibility);

    function teardown() {
      cancelled = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      if (flushRef.current) window.clearInterval(flushRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && ws.readyState <= 1) ws.close();
    }
    return teardown;
    // bbox als String, um Re-Connects bei Pan/Zoom zu vermeiden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, bbox?.join(",")]);

  return { strikes, status };
}

/** LZW-Decoder kompatibel zum Blitzortung-Stream. */
function decodeLzw(input: string): string {
  if (!input) return "";
  const dict: Record<number, string> = {};
  let currChar = input.charAt(0);
  let oldPhrase = currChar;
  const out: string[] = [currChar];
  let code = 256;
  let phrase: string;
  for (let i = 1; i < input.length; i++) {
    const currCode = input.charCodeAt(i);
    if (currCode < 256) phrase = input.charAt(i);
    else phrase = dict[currCode] ? dict[currCode] : oldPhrase + currChar;
    out.push(phrase);
    currChar = phrase.charAt(0);
    dict[code++] = oldPhrase + currChar;
    oldPhrase = phrase;
  }
  return out.join("");
}

/** Altersklassen für die Visualisierung. */
export type StrikeAge = "fresh" | "recent" | "old";
export function classifyAge(t: number, now = Date.now()): StrikeAge {
  const ageMin = (now - t) / 60_000;
  if (ageMin <= 5) return "fresh";
  if (ageMin <= 15) return "recent";
  return "old";
}