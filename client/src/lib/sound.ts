// Voz de bienvenida que acompaña al logo animado. Se puede apagar y el navegador lo recuerda.
const KEY = "cosland_sonido";
const SRC = "/sonido/bienvenida.mp3";
const FALLBACK_MS = 3700;

export const soundOn = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
export const setSoundOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* vale solo para esta visita */ } };

export type WelcomeSound = {
  ready: Promise<void>;                                       // el audio ya está descargado
  play: (onStart: (ms: number) => void) => Promise<boolean>;  // intento automático: true si de verdad empezó a sonar
  tap: (onStart: (ms: number) => void, always?: boolean) => boolean; // dentro de un toque: true si con ese toque arranca la voz
  stop: () => void;                                           // el logo se va: la voz no suena fuera de él
};

// La voz solo suena mientras el logo está en pantalla.
// Los navegadores (sobre todo en iPhone) no dejan sonar nada hasta que la persona toca la página.
// Por eso primero se intenta sola y, si el navegador la bloquea, la entrada espera un toque:
// con ese toque el sonido siempre arranca, a la vez que el logo.
export function welcomeSound(): WelcomeSound | null {
  if (!soundOn() || typeof Audio === "undefined") return null;
  const audio = new Audio();
  audio.volume = 0.9;
  let loaded = false, over = false, started = false, blocked = false, pending = false;
  // Se descarga completo antes de empezar para que arranque al instante, también en iPhone
  const ready = fetch(SRC).then((r) => (r.ok ? r.blob() : Promise.reject()))
    .then((b) => { if (!audio.src) audio.src = URL.createObjectURL(b); loaded = true; })
    .catch(() => {});
  const duration = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : FALLBACK_MS);
  const attempt = (onStart: (ms: number) => void) => {
    pending = true;
    return audio.play().then(() => {
      pending = false;
      if (over) { audio.pause(); return false; }  // llegó tarde: el logo ya se fue
      started = true; blocked = false;
      onStart(duration() - audio.currentTime * 1000);
      return true;
    }, () => { pending = false; if (!over && !started) blocked = true; return false; });
  };
  return {
    ready,
    play(onStart) {
      if (!loaded || over || started) return Promise.resolve(false);
      return attempt(onStart);
    },
    tap(onStart, always = false) {
      if (over || started || pending) return false;
      if (!always && !blocked) return false;
      if (!audio.src) audio.src = SRC; // conexión lenta: no esperó la descarga, se reproduce directo
      attempt(onStart);
      return true;
    },
    stop() {
      over = true; blocked = false;
      // Se apaga con un desvanecido corto si aún sonaba
      if (audio.paused) return;
      const step = () => { if (audio.volume > 0.12) { audio.volume = Math.max(0, audio.volume - 0.15); setTimeout(step, 30); } else audio.pause(); };
      step();
    },
  };
}

export function previewSound() {
  if (typeof Audio === "undefined") return;
  const a = new Audio(SRC); a.volume = 0.9; a.play().catch(() => {});
}
