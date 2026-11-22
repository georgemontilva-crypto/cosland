import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timeAgo, trpc } from "@/lib/api";
import { requireLogin, useSession } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { Avatar, Btn, Empty, H1, Loading, T } from "@/ui/core";
import { PAD } from "@/ui/cards";

export default function Inbox() {
  const insets = useSafeAreaInsets();
  const { me, loading } = useSession();
  const list = trpc.chat.list.useQuery(undefined, { enabled: Boolean(me), refetchInterval: 60_000 });
  return (
    <View style={{ flex: 1, backgroundColor: C.cream, paddingTop: insets.top }}>
      <FlatList
        data={me ? list.data ?? [] : []} keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: PAD, paddingBottom: 40, gap: 8 }}
        refreshing={list.isRefetching} onRefresh={() => { if (me) list.refetch(); }}
        ListHeaderComponent={<H1 style={{ marginBottom: 10 }}>Mensajes</H1>}
        ListEmptyComponent={loading || (me && list.isLoading) ? <Loading /> : !me
          ? <Empty title="Entra para ver tus mensajes" action={<Btn label="Entrar" kind="ink" onPress={() => requireLogin("/mensajes")} />} />
          : <Empty title="Sin conversaciones todavía" text="Cuando le escribas a un vendedor o alguien pregunte por tus artículos, la conversación aparece aquí." action={<Btn label="Explorar" kind="ink" onPress={() => router.push("/explorar")} />} />}
        renderItem={({ item: c }) => (
          <Pressable accessibilityRole="link" accessibilityLabel={`Conversación con ${c.otherName}${c.unread ? `, ${c.unread} sin leer` : ""}`} onPress={() => router.push(`/mensajes/${c.id}`)}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 24, backgroundColor: c.unread ? C.paper : "transparent", borderWidth: BORDER, borderColor: c.unread ? C.ink : "transparent" }, pressed && { backgroundColor: C.paper }]}>
            <Avatar src={c.otherAvatar} name={c.otherName} accent={c.accent} size={50} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <T w="black" numberOfLines={1} style={{ flex: 1 }}>{c.otherName}</T>
                <T size={12} color={C.cocoa}>{timeAgo(c.lastAt)}</T>
              </View>
              <T size={14} w={c.unread ? "bold" : "medium"} color={c.unread ? C.ink : C.cocoa} numberOfLines={1}>{c.lastBody}</T>
              {c.asSeller && <T size={12} color={C.cocoa}>Conversación de tu vitrina</T>}
            </View>
            {c.unread > 0 && <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: C.berry, alignItems: "center", justifyContent: "center" }}><T w="bold" size={12} color={C.paper} style={{ lineHeight: 16 }}>{c.unread}</T></View>}
          </Pressable>
        )}
      />
    </View>
  );
}
