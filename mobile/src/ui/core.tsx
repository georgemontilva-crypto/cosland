import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text as RNText,
  TextInput, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { Image } from "expo-image";
import { ArrowLeft, Check, ChevronDown, Star, X } from "lucide-react-native";
import { BORDER, C, F, accentHex } from "@/lib/theme";
import { img } from "@/lib/api";
import paths from "../../assets/logo/paths.json";

/* ── Texto ── */
type TProps = TextProps & { size?: number; w?: "medium" | "bold" | "black"; color?: string; center?: boolean };
export function T({ size = 15.5, w = "medium", color = C.ink, center, style, ...rest }: TProps) {
  return <RNText {...rest} style={[{ fontFamily: F[w], fontSize: size, lineHeight: Math.round(size * (size > 22 ? 1.15 : 1.42)), color, textAlign: center ? "center" : undefined }, style]} />;
}
export const H1 = (p: TProps) => <T size={30} w="black" {...p} />;
export const H2 = (p: TProps) => <T size={21} w="black" {...p} />;

/* ── Logo vectorial ── */
export function Cat({ width = 64, color = C.ink, style }: { width?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const g = paths.gato;
  return <Svg width={width} height={(width * g.h) / g.w} viewBox={`0 0 ${g.w} ${g.h}`} style={style}><Path d={g.d} fill={color} fillRule="evenodd" /></Svg>;
}
export function Logo({ width = 150, color = C.ink }: { width?: number; color?: string }) {
  const g = paths.logo;
  return <Svg width={width} height={(width * g.h) / g.w} viewBox={`0 0 ${g.w} ${g.h}`} accessibilityLabel="Cosland"><Path d={g.d} fill={color} fillRule="evenodd" /></Svg>;
}

/* ── Botones ── */
type BtnProps = {
  label: string; onPress?: () => void; kind?: "paper" | "ink" | "sakura" | "matcha" | "yuzu" | "ghost" | "danger";
  small?: boolean; icon?: ReactNode; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>; grow?: boolean;
};
export function Btn({ label, onPress, kind = "paper", small, icon, disabled, busy, style, grow }: BtnProps) {
  const bg = { paper: C.paper, ink: C.ink, sakura: C.sakura, matcha: C.matcha, yuzu: C.yuzu, ghost: "transparent", danger: C.berry }[kind];
  const fg = kind === "ink" || kind === "danger" ? C.cream : C.ink;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => [
        s.btn, small && s.btnSm, { backgroundColor: bg, borderColor: kind === "ghost" ? "transparent" : kind === "danger" ? C.berry : C.ink },
        grow && { flex: 1 }, (disabled || busy) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }, style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon}
      <T w="bold" size={small ? 13.5 : 15} color={fg} numberOfLines={1}>{label}</T>
    </Pressable>
  );
}

export function IconBtn({ children, onPress, label, bg = "transparent", size = 42, border }: { children: ReactNode; onPress?: () => void; label: string; bg?: string; size?: number; border?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: bg }, border && { borderWidth: BORDER, borderColor: C.ink }, pressed && { opacity: 0.6 }]}>
      {children}
    </Pressable>
  );
}

/* ── Campos ── */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T w="bold" size={14.5}>{label}</T>
      {children}
      {error ? <T size={13} w="bold" color={C.berry}>{error}</T> : hint ? <T size={13} color={C.cocoa}>{hint}</T> : null}
    </View>
  );
}

export function Input({ style, multiline, ...rest }: TextInputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      placeholderTextColor="rgba(107,90,78,0.7)" multiline={multiline} textAlignVertical={multiline ? "top" : "center"}
      {...rest}
      onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }} onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
      style={[s.input, multiline && { minHeight: 110, paddingTop: 12, borderRadius: 20 }, focus && { borderColor: C.ink, backgroundColor: "#fff" }, style]}
    />
  );
}

type Option = { value: string; label: string };
export function Select({ value, options, onChange, placeholder = "Elegir", title }: { value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string; title: string }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${current?.label ?? placeholder}`} onPress={() => setOpen(true)} style={[s.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
        <T color={current ? C.ink : C.cocoa} numberOfLines={1} style={{ flex: 1 }}>{current?.label ?? placeholder}</T>
        <ChevronDown size={18} color={C.ink} strokeWidth={2.2} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <View style={{ gap: 4 }}>
          {options.map((o) => (
            <Pressable key={o.value} accessibilityRole="button" onPress={() => { onChange(o.value); setOpen(false); }}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 14, borderRadius: 18 }, (pressed || o.value === value) && { backgroundColor: C.oat }]}>
              <T w={o.value === value ? "bold" : "medium"} style={{ flex: 1 }}>{o.label}</T>
              {o.value === value && <Check size={18} color={C.ink} strokeWidth={2.6} />}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </>
  );
}

export function Check2({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: BORDER, borderColor: C.ink, backgroundColor: value ? C.ink : C.paper, alignItems: "center", justifyContent: "center" }}>
        {value && <Check size={16} color={C.cream} strokeWidth={3} />}
      </View>
      <T w="bold" style={{ flex: 1 }}>{label}</T>
    </Pressable>
  );
}

/* ── Píldoras ── */
export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [s.chip, on && { backgroundColor: C.ink, borderColor: C.ink }, pressed && { opacity: 0.7 }]}>
      {icon}
      <T w="bold" size={14} color={on ? C.cream : C.ink}>{label}</T>
    </Pressable>
  );
}
export function Tag({ label, bg = C.paper, icon }: { label: string; bg?: string; icon?: ReactNode }) {
  return <View style={[s.tag, { backgroundColor: bg }]}>{icon}<T w="bold" size={12}>{label}</T></View>;
}

/* ── El toldo de cada vitrina: festones completos en el color del vendedor ── */
export function Awning({ accent, size = 30 }: { accent?: string | null; size?: number }) {
  const [w, setW] = useState(0);
  const color = accentHex(accent);
  const shapes = useMemo(() => {
    if (!w) return null;
    const n = Math.max(2, Math.round(w / (size * 0.95) / 2) * 2); // siempre pares: color, crema, color…
    const sw = w / n, r = sw / 2, drop = Math.max(2, size - r - 1.5);
    return Array.from({ length: n }, (_, i) => (
      <Path key={i} d={`M${i * sw} -2h${sw}v${drop + 2}a${r} ${r} 0 0 1 ${-sw} 0z`} fill={i % 2 ? C.paper : color} stroke={C.ink} strokeWidth={1.5} />
    ));
  }, [w, size, color]);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: size, overflow: "hidden" }} accessibilityElementsHidden importantForAccessibility="no">
      {w > 0 && <Svg width={w} height={size}>{shapes}</Svg>}
    </View>
  );
}

export function Avatar({ src, name, accent, size = 48 }: { src?: string | null; name: string; accent?: string | null; size?: number }) {
  const uri = img(src);
  const base = { width: size, height: size, borderRadius: size / 2, borderWidth: BORDER, borderColor: C.ink } as const;
  return uri
    ? <Image source={{ uri }} style={base} contentFit="cover" />
    : <View style={[base, { backgroundColor: accentHex(accent), alignItems: "center", justifyContent: "center" }]}><T w="black" size={size * 0.42} style={{ lineHeight: size * 0.56 }}>{name.trim().charAt(0).toUpperCase()}</T></View>;
}

// Las fotos de publicaciones van siempre en un marco cuadrado y se ven completas, sin recortes
export function Photo({ src, accent, style }: { src?: string | null; accent?: string | null; style?: StyleProp<ViewStyle> }) {
  const uri = img(src);
  return uri
    ? <Image source={{ uri }} style={[{ width: "100%", height: "100%", backgroundColor: C.oat }, style as object]} contentFit="contain" transition={150} />
    : <View style={[{ width: "100%", height: "100%", backgroundColor: accentHex(accent), alignItems: "center", justifyContent: "center" }, style]}><Cat width={56} /></View>;
}

export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row" }} accessibilityLabel={`${value.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} strokeWidth={1.8} color={i <= Math.round(value) ? C.ink : C.line} fill={i <= Math.round(value) ? C.yuzu : "transparent"} />)}
    </View>
  );
}

/* ── Estados ── */
export function Loading({ label = "Cargando" }: { label?: string }) {
  return <View style={{ paddingVertical: 56, alignItems: "center", gap: 12 }}><Cat width={54} /><T w="bold" color={C.cocoa}>{label}…</T></View>;
}
export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <Cat width={72} />
      <T w="black" size={19} center style={{ marginTop: 14 }}>{title}</T>
      {text ? <T color={C.cocoa} center style={{ marginTop: 6 }}>{text}</T> : null}
      {action ? <View style={{ marginTop: 18 }}>{action}</View> : null}
    </View>
  );
}

/* ── Pantalla con cabecera ── */
export function Screen({ title, children, right, scroll = true, back = true, pad = true, footer }: { title?: string; children: ReactNode; right?: ReactNode; scroll?: boolean; back?: boolean; pad?: boolean; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={{ flex: 1, backgroundColor: C.cream, paddingTop: insets.top }}>
      <View style={s.header}>
        {back ? <IconBtn label="Volver" onPress={goBack}><ArrowLeft size={22} color={C.ink} strokeWidth={2.2} /></IconBtn> : <View style={{ width: 4 }} />}
        <T w="black" size={18} numberOfLines={1} style={{ flex: 1 }}>{title}</T>
        {right}
      </View>
      {scroll ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[pad && { padding: 18 }, { paddingBottom: insets.bottom + 40 }]}>{children}</ScrollView>
        </KeyboardAvoidingView>
      ) : children}
      {footer}
    </View>
  );
}

/* ── Hoja inferior ── */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(42,33,28,0.4)" }]} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <T w="black" size={21} style={{ flex: 1 }}>{title}</T>
            <IconBtn label="Cerrar" onPress={onClose}><X size={22} color={C.ink} /></IconBtn>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Avisos breves ── */
type Toast = { id: number; text: string; bad?: boolean };
const ToastCtx = createContext<(text: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastItem({ t }: { t: Toast }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: true }).start(); }, [a]);
  return (
    <Animated.View style={[s.toast, { backgroundColor: t.bad ? C.sakura : C.matcha, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      <T w="bold" size={14} center>{t.text}</T>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();
  const push = useCallback((text: string, bad?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t.slice(-2), { id, text, bad }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 92, alignItems: "center", gap: 8 }} accessibilityLiveRegion="polite">
        {items.map((t) => <ToastItem key={t.id} t={t} />)}
      </View>
    </ToastCtx.Provider>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, borderWidth: BORDER, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnSm: { minHeight: 38, paddingHorizontal: 14, paddingVertical: 6 },
  input: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, borderWidth: BORDER, borderColor: C.line, backgroundColor: C.paper, fontFamily: F.medium, fontSize: 16, color: C.ink },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, borderWidth: BORDER, borderColor: C.line, backgroundColor: C.paper },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, borderWidth: BORDER, borderColor: C.ink },
  empty: { backgroundColor: C.paper, borderRadius: 30, paddingHorizontal: 24, paddingVertical: 40, alignItems: "center" },
  header: { height: 54, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.faint },
  sheet: { backgroundColor: C.cream, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: BORDER, borderBottomWidth: 0, borderColor: C.ink, padding: 20, maxHeight: "88%" },
  toast: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: BORDER, borderColor: C.ink, maxWidth: 420 },
});

export const panel: ViewStyle = { backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.ink, borderRadius: 28, overflow: "hidden" };
export const soft: ViewStyle = { backgroundColor: C.paper, borderRadius: 26 };
export const textStyle = (w: "medium" | "bold" | "black", size: number): TextStyle => ({ fontFamily: F[w], fontSize: size, color: C.ink });
