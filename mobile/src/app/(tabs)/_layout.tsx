import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Compass, Home, MessageCircle, Plus, Store, User } from "lucide-react-native";
import { useSession } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { T } from "@/ui/core";

const ITEMS: Record<string, { label: string; Icon: typeof Home }> = {
  index: { label: "Inicio", Icon: Home }, explorar: { label: "Explorar", Icon: Compass },
  mensajes: { label: "Mensajes", Icon: MessageCircle }, cuenta: { label: "Mi vitrina", Icon: Store },
};

function Bar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { me } = useSession();
  const tab = (name: string) => {
    const index = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[index];
    if (!route) return null;
    const on = state.index === index;
    const { label, Icon } = ITEMS[name];
    const I = name === "cuenta" && !me ? User : Icon;
    const text = name === "cuenta" && !me ? "Entrar" : label;
    const badge = name === "mensajes" ? me?.unread ?? 0 : 0;
    return (
      <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${text}, ${badge} sin leer` : text}
        onPress={() => { const e = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true }); if (!on && !e.defaultPrevented) navigateToTab(route.key); }}
        style={{ flex: 1, alignItems: "center", paddingTop: 8, gap: 2 }}>
        <View style={{ width: 50, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.yuzu : "transparent" }}>
          <I size={21} color={on ? C.ink : C.cocoa} strokeWidth={2} />
          {badge > 0 && (
            <View style={{ position: "absolute", top: -4, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: C.berry, alignItems: "center", justifyContent: "center" }}>
              <T w="bold" size={11} color={C.paper} style={{ lineHeight: 14 }}>{badge}</T>
            </View>
          )}
        </View>
        <T w="bold" size={11} color={on ? C.ink : C.cocoa}>{text}</T>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", backgroundColor: C.paper, borderTopWidth: BORDER, borderTopColor: C.ink, paddingBottom: Math.max(insets.bottom, 8), minHeight: 62 + Math.max(insets.bottom, 8) }}>
      {tab("index")}
      {tab("explorar")}
      <Pressable accessibilityRole="button" accessibilityLabel="Publicar" onPress={() => router.push("/publicar")} style={({ pressed }) => [{ flex: 1, alignItems: "center", marginTop: -16, gap: 2 }, pressed && { opacity: 0.8 }]}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.sakura, borderWidth: BORDER, borderColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Plus size={25} color={C.ink} strokeWidth={2.6} />
        </View>
        <T w="bold" size={11}>Publicar</T>
      </Pressable>
      {tab("mensajes")}
      {tab("cuenta")}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <Bar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.cream } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explorar" />
      <Tabs.Screen name="mensajes" />
      <Tabs.Screen name="cuenta" />
    </Tabs>
  );
}
