import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { getFlag } from "@/lib/api";
import { C } from "@/lib/theme";
import P from "../../assets/logo/parts.json";

// Entrada animada del logo al abrir la app: el gatito aparece, pestañea dos veces y sonríe.
const IMG = {
  gato: require("../../assets/logo/gato.png"), ojoIzq: require("../../assets/logo/ojoIzq.png"), ojoDer: require("../../assets/logo/ojoDer.png"),
  kana: require("../../assets/logo/kana.png"),
  letras: [require("../../assets/logo/letra0.png"), require("../../assets/logo/letra1.png"), require("../../assets/logo/letra2.png"), require("../../assets/logo/letra3.png"),
    require("../../assets/logo/letra4.png"), require("../../assets/logo/letra5.png"), require("../../assets/logo/letra6.png")],
};
type Box = { x: number; y: number; w: number; h: number };

// Voz de bienvenida. Respeta el modo silencio o vibración del teléfono y no corta la música que esté sonando.
const VOICE = require("../../assets/sonido/bienvenida.mp3");
export const SOUND_KEY = "cosland_sonido";
export function playWelcome() {
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  let stopped = false;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false })
    .catch(() => {})
    .then(() => {
      if (stopped) return;
      try {
        player = createAudioPlayer(VOICE);
        player.volume = 0.9;
        player.play();
      } catch { /* sin audio: la entrada sigue en silencio */ }
    });
  const free = setTimeout(() => { try { player?.remove(); } catch { /* ya liberado */ } player = null; }, 8000);
  return () => { stopped = true; clearTimeout(free); try { player?.remove(); } catch { /* ya liberado */ } player = null; };
}

export default function Intro() {
  const { width, height } = useWindowDimensions();
  const [done, setDone] = useState(false);
  const cat = useRef(new Animated.Value(0)).current;
  const letters = useRef(P.letras.map(() => new Animated.Value(0))).current;
  const kana = useRef(new Animated.Value(0)).current;
  const eye = useRef(new Animated.Value(0)).current;     // 0 cerrado, 1 abierto
  const smile = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);

  const exit = () => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(leave, { toValue: 1, duration: 480, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setDone(true));
  };

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live) return;
      if (reduce) { setDone(true); return; }
      if (getFlag(SOUND_KEY) !== "0") playWelcome(); // la voz termina sola aunque el logo ya se haya ido
      const spring = (v: Animated.Value) => Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true });
      const blink = Animated.sequence([
        Animated.timing(eye, { toValue: 0.08, duration: 85, useNativeDriver: true }),
        Animated.timing(eye, { toValue: 1, duration: 95, useNativeDriver: true }),
      ]);
      Animated.sequence([
        Animated.parallel([
          spring(cat),
          Animated.sequence([Animated.delay(260), Animated.spring(eye, { toValue: 1, friction: 6, useNativeDriver: true })]),
          Animated.sequence([Animated.delay(320), Animated.stagger(70, letters.map(spring))]),
          Animated.sequence([Animated.delay(900), Animated.timing(kana, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
        ]),
        Animated.delay(120), blink, Animated.delay(240), blink, Animated.delay(260),
        Animated.parallel([
          Animated.timing(eye, { toValue: 0, duration: 110, useNativeDriver: true }),
          Animated.sequence([Animated.delay(70), Animated.spring(smile, { toValue: 1, friction: 5, useNativeDriver: true })]),
        ]),
        Animated.delay(380),
      ]).start(({ finished }) => { if (finished) exit(); });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;
  const W = Math.min(width * 0.82, 420);
  const H = W / P.ratio;
  const at = (b: Box) => ({ position: "absolute" as const, left: (b.x / 100) * W, top: (b.y / 100) * H, width: (b.w / 100) * W, height: (b.h / 100) * H });
  const pop = (v: Animated.Value, dy = 0) => ({ opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] });
  const eyeBox = (b: Box) => {
    const box = at(b), d = box.height * 1.05;
    return (
      <View style={box}>
        <Animated.View style={{ position: "absolute", left: (box.width - d) / 2, top: (box.height - d) / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: C.cream, transform: [{ scaleY: eye }] }} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: smile, transform: [{ scale: smile.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
          <Image source={b === P.ojoIzq ? IMG.ojoIzq : IMG.ojoDer} style={{ width: "100%", height: "100%" }} contentFit="fill" />
        </Animated.View>
      </View>
    );
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: C.cream, transform: [{ translateY: leave.interpolate({ inputRange: [0, 1], outputRange: [0, -height - 40] }) }] }]}>
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center" }} onPress={exit} accessibilityLabel="Cosland" accessibilityRole="image">
        <View style={{ width: W, height: H }}>
          <Animated.View style={[StyleSheet.absoluteFill, pop(cat)]}>
            <Image source={IMG.gato} style={at(P.gato)} contentFit="fill" />
            {eyeBox(P.ojoIzq)}
            {eyeBox(P.ojoDer)}
          </Animated.View>
          {P.letras.map((b, i) => (
            <Animated.View key={i} style={[at(b), pop(letters[i], H * 0.25)]}><Image source={IMG.letras[i]} style={{ width: "100%", height: "100%" }} contentFit="fill" /></Animated.View>
          ))}
          <Animated.View style={[at(P.kana), { opacity: kana, transform: [{ scaleX: kana.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
            <Image source={IMG.kana} style={{ width: "100%", height: "100%" }} contentFit="fill" />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
