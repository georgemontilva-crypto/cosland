import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Volume2 } from "lucide-react";
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

// Dónde la entrada espera un toque si el navegador bloquea el sonido: al abrir Cosland por la portada
// o como app instalada. Quien llega por el enlace de una publicación o vitrina entra directo.
function gateHere() {
  try {
    const nav = navigator as Navigator & { standalone?: boolean };
    return location.pathname === "/" || window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  } catch { return false; }
}

export default function Intro() {
  const [phase, setPhase] = useState<"wait" | "gate" | "play" | "leave" | "done">(() => (shouldPlay() ? "wait" : "done"));
  const [sound] = useState(() => (shouldPlay() ? welcomeSound() : null));
  const [fromGate, setFromGate] = useState(false);
  const t0 = useRef(0), voiceEnd = useRef(0), timer = useRef<ReturnType<typeof setTimeout>>();
  const now = useRef(phase); now.current = phase;

  // El logo se va cuando termina su animación o, si la voz suena, cuando termina de hablar
  const plan = () => {
    if (!t0.current) return;
    clearTimeout(timer.current);
    const leaveAt = Math.max(t0.current + PLAY_MS, voiceEnd.current - 80);
    timer.current = setTimeout(() => setPhase("leave"), Math.max(0, leaveAt - performance.now()));
  };
  // La voz empezó de verdad: el logo arranca con ella, venga de donde venga
  const onVoice = (ms: number) => {
    voiceEnd.current = performance.now() + Math.min(ms, MAX_VOICE_MS);
    setPhase((p) => (p === "wait" || p === "gate" ? "play" : p));
    plan();
  };

  // Espera a que las piezas estén cargadas para que nada aparezca a destiempo
  useEffect(() => {
    if (phase !== "wait") return;
    let live = true, moved = false;
    const gate = Boolean(sound) && gateHere();
    const go = (next: "play" | "gate") => { if (live && !moved) { moved = true; if (next === "gate") setFromGate(true); setPhase((p) => (p === "wait" ? next : p)); } };
    const loads = FILES.map((src) => new Promise<void>((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(); i.src = src; }));
    Promise.all([...loads, sound?.ready]).then(async () => {
      // Conexión lenta: ya estaba esperando el toque; si el navegador deja, arranca sola en cuanto baja el audio
      if (moved) { if (gate && now.current === "gate") sound?.play(onVoice); return; }
      if (!live) return;
      if (!sound) return go("play");
      const sounding = await sound.play(onVoice); // si el navegador deja, suena sola con el logo
      if (!sounding) go(gate ? "gate" : "play");
    });
    const t = setTimeout(() => go(gate ? "gate" : "play"), 1500);
    return () => { live = false; clearTimeout(t); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === "play") {
      try { sessionStorage.setItem(KEY, "1"); } catch { /* no pasa nada */ }
      t0.current = performance.now();
      plan();
      return () => clearTimeout(timer.current);
    }
    if (phase === "leave") {
      sound?.stop(); // la voz nunca suena con el logo ya fuera
      const t = setTimeout(() => setPhase("done"), LEAVE_MS);
      return () => clearTimeout(t);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // En la espera, el toque enciende la voz y arranca el logo a la vez.
  // Con el logo ya andando, un toque lo salta; si la voz estaba bloqueada, ese toque la enciende.
  const onTap = () => {
    if (phase === "gate") { sound?.tap(onVoice, true); setPhase("play"); return; }
    if (phase !== "play") return;
    if (sound?.tap(onVoice)) return;
    setPhase("leave");
  };
  // Con teclado: Enter o espacio entran igual que el toque
  useEffect(() => {
    if (phase !== "gate") return;
    const key = (e: KeyboardEvent) => {
      if ((e.key !== "Enter" && e.key !== " ") || e.target instanceof HTMLButtonElement) return;
      e.preventDefault(); sound?.tap(onVoice, true); setPhase("play");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const enterSilent = (e: MouseEvent) => { e.stopPropagation(); sound?.stop(); setPhase("play"); };

  if (phase === "done") return null;
  const eye = (b: Box, file: string) => (
    <div className="absolute" style={at(b)}>
      <span className="intro-eye-open" />
      <img src={`/logo/${file}.png`} alt="" className="intro-eye-smile absolute inset-0 w-full h-full" />
    </div>
  );

  return (
    <div
      className={`intro ${phase === "gate" ? "intro-gate" : ""} ${fromGate ? "intro-from-gate" : ""} ${phase === "play" ? "intro-go" : ""} ${phase === "leave" ? "intro-go intro-leave" : ""}`}
      style={{ "--cat-x": `${50 - (P.gato.x + P.gato.w / 2)}%` } as CSSProperties}
      onClick={onTap}
      role="presentation"
    >
      {phase === "gate" && (
        <div className="intro-enter">
          <button type="button" className="btn btn-ink intro-enter-btn"><Volume2 size={19} />Entrar</button>
          <button type="button" className="intro-enter-mute" onClick={enterSilent}>Entrar sin sonido</button>
        </div>
      )}
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
