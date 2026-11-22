import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Loading } from "@/components/ui";
import { ListingGrid, ShopCard } from "@/components/cards";

export default function Favorites() {
  const { me, loading } = useMe();
  const q = trpc.listing.favorites.useQuery(undefined, { enabled: Boolean(me) });
  const following = trpc.shop.following.useQuery(undefined, { enabled: Boolean(me) });
  return (
    <div className="wrap pt-6 md:pt-10">
      <h1 className="text-3xl md:text-5xl mb-7">Favoritos</h1>
      {loading || (me && q.isLoading) ? <Loading /> : !me ? (
        <Empty title="Entra para ver tus favoritos" action={<Link href="/entrar?volver=/favoritos" className="btn btn-ink">Entrar</Link>} />
      ) : q.data?.length ? <ListingGrid items={q.data} /> : (
        <Empty title="Aún no guardas nada" action={<Link href="/explorar" className="btn btn-ink">Explorar</Link>}>Toca el corazón en cualquier publicación para guardarla aquí.</Empty>
      )}
      {me && (following.data?.length ?? 0) > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl md:text-3xl mb-5">Vitrinas que sigues</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{following.data!.map((s) => <ShopCard key={s.id} shop={s} />)}</div>
        </section>
      )}
    </div>
  );
}
