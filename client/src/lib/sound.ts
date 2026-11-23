// Voz de bienvenida que acompaña al logo animado. Se puede apagar y el navegador lo recuerda.
const KEY = "cosland_sonido";
const SRC = "/sonido/bienvenida.mp3";
const FALLBACK_MS = 3700;

export const soundOn = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
export const setSoundOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* vale solo para esta visita */ } };

export type WelcomeSound = {
  ready: Promise<void>;                          // el audio ya está descargado
  play: (onStart: (ms: number) => void) => void; // intenta sonar; avisa cuánto dura cuando de verdad empieza
  tap: () => boolean;                            // toque sobre el logo: true si con ese toque empezó la voz
  stop: () => void;                              // el logo se va: la voz no suena fuera de él
};

// La voz solo suena mientras el logo está en pantalla.
// Los navegadores no dejan sonar nada hasta que la persona toca la página: se intenta al empezar
// la animación y, si el navegador lo bloquea, un toque sobre el logo la enciende. Si no, silencio.
export function welcomeSound(): WelcomeSound | null {
  if (!soundOn() || typeof Audio === "undefined") return null;
  const audio = new Audio();
  audio.volume = 0.9;
  // Se descarga completo antes de empezar para que arranque al instante, también en iPhone
  const ready = fetch(SRC).then((r) => (r.ok ? r.blob() : Promise.reject()))
    .then((b) => { audio.src = URL.createObjectURL(b); loaded = true; })
    .catch(() => {});
  let loaded = false, over = false, started = false, blocked = false;
  let onStart: (ms: number) => void = () => {};
  const duration = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : FALLBACK_MS);
  const attempt = () => audio.play().then(() => {
    if (over) { audio.pause(); return; }         // llegó tarde: el logo ya se fue
    started = true; blocked = false;
    onStart(duration() - audio.currentTime * 1000);
  });
  return {
    ready,
    play(cb) {
      if (!loaded) { over = true; return; } // con conexión lenta no llegó a tiempo: la entrada va en silencio
      onStart = cb;
      attempt().catch(() => { if (!over && !started) blocked = true; });
    },
    tap() {
      if (over || started || !blocked) return false;
      blocked = false;
      attempt().catch(() => {});
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
