import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { BadgeCheck } from "lucide-react-native";
import { timeAgo, trpc } from "@/lib/api";
import { C } from "@/lib/theme";
import { Avatar, Loading, Sheet, T } from "./core";

// Quién sigue a una vitrina. Quien tiene vitrina propia aparece con ella y se puede visitar.
export default function FollowersSheet({ open, onClose, shopId, mine }: { open: boolean; onClose: () => void; shopId: number; mine?: boolean }) {
  const q = trpc.shop.followers.useQuery({ shopId }, { enabled: open });
  return (
    <Sheet open={open} onClose={onClose} title="Seguidores">
      {q.isLoading ? <Loading /> : !q.data?.length ? (
        <T color={C.cocoa} center style={{ paddingVertical: 24 }}>{mine ? "Aún nadie sigue tu vitrina. Compártela para que te encuentren." : "Aún nadie sigue esta vitrina."}</T>
      ) : (
        <View style={{ gap: 4 }}>
          {q.data.map((f) => (
            <Pressable key={f.id} disabled={!f.handle} accessibilityRole={f.handle ? "link" : undefined} accessibilityLabel={f.handle ? `Ver la vitrina de ${f.name}` : f.name}
              onPress={() => { onClose(); router.push(`/v/${f.handle}`); }}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 22 }, pressed && { backgroundColor: C.paper }]}>
              <Avatar src={f.avatarUrl} name={f.name} accent={f.accent} size={46} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <T w="black" numberOfLines={1} style={{ flexShrink: 1 }}>{f.name}</T>
                  {f.verified && <BadgeCheck size={15} color={C.ink} />}
                </View>
                <T size={13} color={C.cocoa}>{mine ? "Te sigue" : "La sigue"} desde {timeAgo(f.at)}</T>
              </View>
              {f.handle ? <T w="bold" size={13.5} style={{ textDecorationLine: "underline" }}>Ver vitrina</T> : null}
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}
