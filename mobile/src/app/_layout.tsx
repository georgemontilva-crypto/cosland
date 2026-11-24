import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/api";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/ui/core";
import Intro from "@/ui/Intro";
import LockGate from "@/ui/LockGate";
import { listenAlertTaps, setupAlerts } from "@/lib/alerts";
import { C } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
setupAlerts();

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({
    MPlus500: require("../../assets/fonts/MPlusRounded-500Medium.ttf"),
    MPlus700: require("../../assets/fonts/MPlusRounded-700Bold.ttf"),
    MPlus800: require("../../assets/fonts/MPlusRounded-800ExtraBold.ttf"),
  });
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } }));
  const ready = fontsReady || Boolean(fontError);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  // Tocar una notificación abre su pantalla (cuando la navegación ya está montada)
  useEffect(() => (ready ? listenAlertTaps() : undefined), [ready]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.cream }} />;

  return (
    <SafeAreaProvider>
      <trpc.Provider client={trpcClient} queryClient={qc}>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <SessionProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream }, animation: "slide_from_right" }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="publicar" options={{ animation: "slide_from_bottom" }} />
                <Stack.Screen name="entrar" options={{ animation: "slide_from_bottom" }} />
                <Stack.Screen name="registro" options={{ animation: "slide_from_bottom" }} />
              </Stack>
              <LockGate />
              <Intro />
            </SessionProvider>
          </ToastProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SafeAreaProvider>
  );
}
