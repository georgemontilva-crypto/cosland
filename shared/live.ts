// Novedades en vivo, lado del cliente (lo usan la web y la app).
// El servidor manda solo temas cortos ("l:12", "s:3", "feed"…). Aquí se decide qué
// consultas tocan esos temas; solo las que están en pantalla se vuelven a pedir,
// el resto queda marcado para refrescarse la próxima vez que se abran.
//
// Para no cargar el servidor:
//  · los avisos se juntan y se aplican con un pequeño retraso al azar, así no piden todos a la vez;
//  · las listas grandes (inicio, explorar, vitrinas) se refrescan como mucho cada LIST_EVERY_MS;
//  · con la pestaña o la app en segundo plano no se pide nada: se pone al día al volver.

type LiveQuery = { queryKey: readonly unknown[]; state: { data: unknown } };
export type LiveClient = { invalidateQueries: (filters: { predicate: (q: LiveQuery) => boolean }) => unknown };

const LIST_EVERY_MS = 15_000;
const LIST_TOPICS = new Set(["feed", "shops", "wanted", "all"]);

const FIXED: Record<string, string[]> = {
  feed: ["listing.home", "listing.search", "listing.favorites"],
  shops: ["shop.list", "shop.following", "listing.home"],
  wanted: ["wanted.list", "listing.home"],
  support: ["support.info"],
  me: ["auth.me", "shop.mine", "listing.mine", "support.mine"],
};

function matches(q: LiveQuery, topic: string): boolean {
  const path = Array.isArray(q.queryKey[0]) ? (q.queryKey[0] as string[]).join(".") : "";
  if (!path) return false;
  if (topic === "all") return path !== "auth.site";
  if (topic === "admin") return path.startsWith("admin.");
  const fixed = FIXED[topic];
  if (fixed) return fixed.includes(path);

  const id = Number(topic.slice(2));
  const input = ((q.queryKey[1] as { input?: Record<string, unknown> } | undefined)?.input ?? {}) as Record<string, unknown>;
  const data = q.state.data as { id?: number; shop?: { id?: number } } | undefined;
  if (topic.startsWith("l:")) return path === "listing.byId" && input.id === id;
  if (topic.startsWith("s:")) {
    if (path === "shop.byHandle") return data?.id === id;
    if (path === "listing.byId") return data?.shop?.id === id;
    return (path === "shop.followers" || path === "review.list" || path === "listing.search") && input.shopId === id;
  }
  return false;
}

export function createLive(client: LiveClient) {
  const now = new Set<string>();   // se aplican casi al instante
  const lists = new Set<string>(); // se aplican espaciados
  let visible = true;
  let nowTimer: ReturnType<typeof setTimeout> | undefined;
  let listTimer: ReturnType<typeof setTimeout> | undefined;
  let lastList = 0;
  let lastCatchUp = 0;

  const apply = (set: Set<string>) => {
    const topics = [...set];
    set.clear();
    if (topics.length) client.invalidateQueries({ predicate: (q) => topics.some((t) => matches(q, t)) });
  };
  const schedule = () => {
    if (!visible) return;
    if (now.size && !nowTimer) {
      nowTimer = setTimeout(() => { nowTimer = undefined; apply(now); }, 150 + Math.random() * 650);
    }
    if (lists.size && !listTimer) {
      const wait = Math.max(0, lastList + LIST_EVERY_MS - Date.now()) + 300 + Math.random() * 1700;
      listTimer = setTimeout(() => { listTimer = undefined; lastList = Date.now(); apply(lists); }, wait);
    }
  };
  const pause = () => { clearTimeout(nowTimer); clearTimeout(listTimer); nowTimer = listTimer = undefined; };

  return {
    // Temas que llegaron del servidor
    push(topics: string[]) {
      for (const t of topics) (LIST_TOPICS.has(t) ? lists : now).add(t);
      schedule();
    },
    // Ponerse al día después de estar en segundo plano o sin conexión
    catchUp() {
      if (Date.now() - lastCatchUp < 5000) return; // volver a la vista y reconectar suelen llegar juntos
      lastCatchUp = Date.now();
      now.add("all"); lists.clear(); schedule();
    },
    setVisible(v: boolean) { visible = v; if (v) schedule(); else pause(); },
    stop: pause,
  };
}

// Espera antes de reintentar la conexión: crece con cada fallo y lleva azar
export const retryDelay = (attempt: number) => Math.min(60_000, 3000 * 2 ** attempt) + Math.random() * 2000;
