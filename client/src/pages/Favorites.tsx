import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Loading } from "@/components/ui";
import { ListingGrid } from "@/components/cards";

export default function Favorites() {
  const { me, loading } = useMe();
  const q = trpc.listing.favorites.useQuery(undefined, { enabled: Boolean(me) });
  return (
    <div className="wrap pt-6 md:pt-10">
      <h1 className="text-3xl md:text-5xl mb-7">Favoritos</h1>
      {loading || (me && q.isLoading) ? <Loading /> : !me ? (
        <Empty title="Entra para ver tus favoritos" action={<Link href="/entrar?volver=/favoritos" className="btn btn-ink">Entrar</Link>} />
      ) : q.data?.length ? <ListingGrid items={q.data} /> : (
        <Empty title="Aún no guardas nada" action={<Link href="/explorar" className="btn btn-ink">Explorar</Link>}>Toca el corazón en cualquier publicación para guardarla aquí.</Empty>
      )}
    </div>
  );
}
