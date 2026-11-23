import { useEffect, useState, type CSSProperties } from "react";
import P from "@/lib/logoParts.json";
import { welcomeSound } from "@/lib/sound";

// Entrada animada del logo: una vez por visita, y nunca si la persona pidió menos movimiento.
const KEY = "cosland_intro";
const PLAY_MS = 2350;
const LEAVE_MS = 560;
const MAX_VOICE_MS = 5000;

type Box = { x: number; y: number; w: number; h: number };
const at = (b: Box): CSSProperties => ({ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` });
const FILES = ["gato", "ojoIzq", "ojoDer", "kana", ...P.letras.map((_, i) => `letra${i}`)].map((n) => `/logo/${n}.png`);

function shouldPlay() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (sessionStorage.getItem(KEY)) return false;
  } catch { /* sin almacenamiento: se muestra */ }
  return true;
}

export default function Intro() {
  const [phase, setPhase] = useState<"wait" | "play" | "leave" | "done">(() => (shouldPlay() ? "wait" : "done"));
  const [sound] = useState(() => (shouldPlay() ? welcomeSound() : null));

  // Espera a que las piezas estén cargadas para que nada aparezca a destiempo
  useEffect(() => {
    if (phase !== "wait") return;
    let live = true;
    const start = () => { if (live) setPhase("play"); };
    const loads = FILES.map((src) => new Promise<void>((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(); i.src = src; }));
    Promise.all([...loads, sound?.ready]).then(start);
    const t = setTimeout(start, 1500);
    return () => { live = false; clearTimeout(t); };
  }, [phase]);

  useEffect(() => {
    if (phase === "play") {
      try { sessionStorage.setItem(KEY, "1"); } catch { /* no pasa nada */ }
      const t0 = performance.now();
      let t = setTimeout(() => setPhase("leave"), PLAY_MS);
      // Si la voz suena, el logo se queda hasta que termina de hablar
      sound?.play((ms) => {
        const until = Math.max(PLAY_MS, performance.now() - t0 + Math.min(ms, MAX_VOICE_MS) - 80);
        clearTimeout(t);
        t = setTimeout(() => setPhase("leave"), until - (performance.now() - t0));
      });
      return () => clearTimeout(t);
    }
    if (phase === "leave") {
      sound?.stop(); // la voz nunca suena con el logo ya fuera
      const t = setTimeout(() => setPhase("done"), LEAVE_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Un toque salta la entrada; si el navegador tenía la voz bloqueada, ese toque la enciende
  const onTap = () => {
    if (phase !== "play") return;
    if (sound?.tap()) return;
    setPhase("leave");
  };

  if (phase === "done") return null;
  const eye = (b: Box, file: string) => (
    <div className="absolute" style={at(b)}>
      <span className="intro-eye-open" />
      <img src={`/logo/${file}.png`} alt="" className="intro-eye-smile absolute inset-0 w-full h-full" />
    </div>
  );

  return (
    <div
      className={`intro ${phase === "play" ? "intro-go" : ""} ${phase === "leave" ? "intro-go intro-leave" : ""}`}
      onClick={onTap}
      role="presentation"
    >
      <div className="intro-logo" style={{ aspectRatio: String(P.ratio) }} role="img" aria-label="Cosland">
        <div className="intro-cat absolute inset-0">
          <img src="/logo/gato.png" alt="" className="absolute" style={at(P.gato)} />
          {eye(P.ojoIzq, "ojoIzq")}
          {eye(P.ojoDer, "ojoDer")}
        </div>
        {P.letras.map((b, i) => (
          <img key={i} src={`/logo/letra${i}.png`} alt="" className="intro-letter absolute" style={{ ...at(b), animationDelay: `${380 + i * 75}ms` }} />
        ))}
        <img src="/logo/kana.png" alt="" className="intro-kana absolute" style={at(P.kana)} />
      </div>
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="intro-wave" aria-hidden>
        <path fill="#fbf1dc" d="M0 0h1440v24c-120 30-240 30-360 0s-240-30-360 0-240 30-360 0S120-6 0 24z" />
      </svg>
    </div>
  );
}
