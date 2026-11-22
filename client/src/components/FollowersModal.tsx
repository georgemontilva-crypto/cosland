import { Link } from "wouter";
import { BadgeCheck } from "lucide-react";
import { trpc, timeAgo } from "@/lib/trpc";
import { Avatar, Loading, Modal } from "./ui";

// Quién sigue a una vitrina. Quien tiene vitrina propia aparece con ella y se puede visitar.
export default function FollowersModal({ shopId, mine, onClose }: { shopId: number; mine?: boolean; onClose: () => void }) {
  const q = trpc.shop.followers.useQuery({ shopId });
  return (
    <Modal title="Seguidores" onClose={onClose}>
      {q.isLoading ? <Loading /> : !q.data?.length ? (
        <p className="text-cocoa py-6 text-center">{mine ? "Aún nadie sigue tu vitrina. Compártela para que te encuentren." : "Aún nadie sigue esta vitrina."}</p>
      ) : (
        <ul className="grid gap-1.5">
          {q.data.map((f) => {
            const row = (
              <>
                <Avatar src={f.avatarUrl} name={f.name} accent={f.accent} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="font-extrabold flex items-center gap-1"><span className="truncate">{f.name}</span>{f.verified && <BadgeCheck size={15} aria-label="Vitrina verificada" />}</span>
                  <span className="block text-sm text-cocoa">{mine ? "Te sigue" : "La sigue"} desde {timeAgo(f.at)}</span>
                </span>
                {f.handle && <span className="text-sm font-bold underline underline-offset-4 shrink-0">Ver vitrina</span>}
              </>
            );
            const cls = "flex items-center gap-3 p-2.5 rounded-[1.4rem]";
            return (
              <li key={f.id}>
                {f.handle
                  ? <Link href={`/v/${f.handle}`} onClick={onClose} className={`${cls} hover:bg-paper`}>{row}</Link>
                  : <div className={cls}>{row}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
