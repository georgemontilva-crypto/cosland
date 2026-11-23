// Voz de bienvenida que acompaña al logo animado. Se puede apagar y el navegador lo recuerda.
const KEY = "cosland_sonido";
const SRC = "/sonido/bienvenida.mp3";

export const soundOn = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
export const setSoundOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* vale solo para esta visita */ } };

// Los navegadores no dejan sonar nada hasta que la persona toca la página.
// Se intenta al empezar la animación; si el navegador lo bloquea, suena con el primer toque
// mientras el logo siga en pantalla, y si no hubo toque, la entrada queda en silencio.
export function welcomeSound() {
  if (!soundOn() || typeof Audio === "undefined") return { play() {}, stop() {} };
  const audio = new Audio(SRC);
  audio.preload = "auto";
  audio.volume = 0.9;
  let waiting = false, started = false;
  const onGesture = () => { release(); if (!started) { started = true; audio.play().catch(() => {}); } };
  const release = () => {
    if (!waiting) return;
    waiting = false;
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
  };
  return {
    play() {
      audio.play().then(() => { started = true; }).catch(() => {
        if (started) return;
        waiting = true;
        window.addEventListener("pointerdown", onGesture, true);
        window.addEventListener("keydown", onGesture, true);
      });
    },
    // Al terminar la animación ya no se espera ningún toque; si la voz ya suena, termina sola
    stop: release,
  };
}

export function previewSound() {
  if (typeof Audio === "undefined") return;
  const a = new Audio(SRC); a.volume = 0.9; a.play().catch(() => {});
}
