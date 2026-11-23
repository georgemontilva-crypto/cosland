import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { router } from "expo-router";
import { LayoutGrid, Search, X } from "lucide-react-native";
import { formatPrice } from "@shared/catalog";
import { trpc } from "@/lib/api";
import { BORDER, C } from "@/lib/theme";
import { Avatar, Btn, Input, Photo, T } from "./core";

type Props = {
  value: string; onChange: (v: string) => void;
  onSubmit: (q: string) => void;   // buscar ese texto
  placeholder: string; label: string; big?: boolean;
};

// Resalta lo que la persona ya escribió dentro de la sugerencia
function Mark({ text, q, lines = 1 }: { text: string; q: string; lines?: number }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <T numberOfLines={lines} style={{ flexShrink: 1 }}>{text}</T>;
  return <T numberOfLines={lines} style={{ flexShrink: 1 }}>{text.slice(0, i)}<T w="black">{text.slice(i, i + q.length)}</T>{text.slice(i + q.length)}</T>;
}

// Buscador con sugerencias desde la primera letra: personajes y series, categorías, vitrinas y publicaciones
export default function SearchField({ value, onChange, onSubmit, placeholder, label, big }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const blur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typed = value.trim();
  // Espera un instante entre teclas para no consultar por cada letra
  const [q, setQ] = useState(typed);
  useEffect(() => { const t = setTimeout(() => setQ(typed), 120); return () => clearTimeout(t); }, [typed]);
  useEffect(() => () => clearTimeout(blur.current), []);
  const open = focused && !hidden && typed.length > 0;
  const res = trpc.listing.suggest.useQuery({ q }, { enabled: open && q.length > 0, placeholderData: (prev) => prev, staleTime: 30_000 });
  const data = q && typed ? res.data : undefined;

  const done = () => { setHidden(true); Keyboard.dismiss(); };
  const search = (text: string) => { onChange(text); done(); onSubmit(text); };
  const leave = (to: string) => { done(); router.push(to as never); };

  // Una fila tocable de la lista (función y no componente: así no se vuelve a montar mientras llegan resultados)
  const row = (key: string, onPress: () => void, a11y: string, children: ReactNode) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 50, backgroundColor: pressed ? C.oat : "transparent" })}>
      {children}
    </Pressable>
  );
  const hint = (text: string) => <T size={13.5} color={C.cocoa} style={{ marginLeft: "auto", paddingLeft: 8 }}>{text}</T>;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Input value={value} onChangeText={(v) => { onChange(v); setHidden(false); }} placeholder={placeholder} accessibilityLabel={label}
            returnKeyType="search" autoCorrect={false} autoCapitalize="none" onSubmitEditing={() => { done(); onSubmit(typed); }}
            onFocus={() => { clearTimeout(blur.current); setFocused(true); setHidden(false); }}
            // El toque en una sugerencia llega un instante después de perder el foco: se espera para no esconderla antes
            onBlur={() => { blur.current = setTimeout(() => setFocused(false), 200); }}
            style={{ borderRadius: 999, paddingLeft: 44, paddingRight: typed ? 44 : 16, ...(big ? { borderColor: C.ink, minHeight: 52 } : {}) }} />
          <View pointerEvents="none" style={{ position: "absolute", left: 16 }}><Search size={big ? 19 : 18} color={C.cocoa} /></View>
          {typed ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Borrar la búsqueda" hitSlop={8} onPress={() => { onChange(""); setHidden(false); }}
              style={{ position: "absolute", right: 8, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }}>
              <X size={17} color={C.ink} />
            </Pressable>
          ) : null}
        </View>
        <Btn label="Buscar" kind="ink" onPress={() => { done(); onSubmit(typed); }} style={big ? { minHeight: 52 } : undefined} />
      </View>
      {open && (
        <View accessibilityLabel="Sugerencias" style={{ backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.ink, borderRadius: 24, paddingVertical: 6, overflow: "hidden" }}>
          {row("q", () => search(typed), `Buscar ${typed}`, <>
            <Search size={18} color={C.cocoa} /><T numberOfLines={1} style={{ flexShrink: 1 }}>Buscar “<T w="black">{typed}</T>”</T>
          </>)}
          {(data?.terms ?? []).map((t) => row(`t-${t.kind}-${t.text}`, () => search(t.text), `${t.text}, ${t.kind}`, <>
            <Search size={18} color={C.cocoa} /><Mark text={t.text} q={typed} />{hint(t.kind === "personaje" ? "Personaje" : "Serie")}
          </>))}
          {(data?.categories ?? []).map((c) => row(`c-${c.id}`, () => { done(); router.push({ pathname: "/explorar", params: { category: c.id, kind: c.kind } }); }, `${c.label}, categoría`, <>
            <LayoutGrid size={18} color={C.cocoa} /><Mark text={c.label} q={typed} />{hint("Categoría")}
          </>))}
          {(data?.shops ?? []).map((s) => row(`s-${s.handle}`, () => leave(`/v/${s.handle}`), `${s.name}, vitrina`, <>
            <Avatar src={s.avatarUrl} name={s.name} accent={s.accent} size={32} /><Mark text={s.name} q={typed} />{hint("Vitrina")}
          </>))}
          {(data?.items ?? []).map((i) => row(`i-${i.id}`, () => leave(`/p/${i.id}`), `${i.title}, ${formatPrice(i.priceCents, i.deal)}`, <>
            <View style={{ width: 40, height: 40, borderRadius: 12, overflow: "hidden", borderWidth: BORDER, borderColor: C.line }}><Photo src={i.image} accent={i.shopAccent} /></View>
            <View style={{ flex: 1 }}><Mark text={i.title} q={typed} lines={2} /><T size={13.5} color={C.cocoa} numberOfLines={1}>{i.shopName}</T></View>
            <T w="bold">{formatPrice(i.priceCents, i.deal)}</T>
          </>))}
        </View>
      )}
    </View>
  );
}
