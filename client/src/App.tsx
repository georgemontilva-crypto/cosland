import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ListingPage from "./pages/ListingPage";
import ShopPage from "./pages/ShopPage";
import Shops from "./pages/Shops";
import Wanted from "./pages/Wanted";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ShopForm from "./pages/ShopForm";
import ListingForm from "./pages/ListingForm";
import Favorites from "./pages/Favorites";
import Messages from "./pages/Messages";
import Admin from "./pages/Admin";
import Safety from "./pages/Safety";
import { Empty } from "./components/ui";
import { Link } from "wouter";

function ScrollTop() {
  const [path] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  return null;
}

export default function App() {
  return (
    <Layout>
      <ScrollTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/explorar" component={Explore} />
        <Route path="/p/:id">{(p) => <ListingPage id={Number(p.id)} />}</Route>
        <Route path="/v/:handle">{(p) => <ShopPage handle={p.handle} />}</Route>
        <Route path="/vitrinas" component={Shops} />
        <Route path="/se-busca" component={Wanted} />
        <Route path="/entrar">{() => <Auth mode="login" />}</Route>
        <Route path="/registro">{() => <Auth mode="register" />}</Route>
        <Route path="/mi-vitrina" component={Dashboard} />
        <Route path="/mi-vitrina/editar" component={ShopForm} />
        <Route path="/publicar">{() => <ListingForm />}</Route>
        <Route path="/editar/:id">{(p) => <ListingForm id={Number(p.id)} />}</Route>
        <Route path="/favoritos" component={Favorites} />
        <Route path="/mensajes">{() => <Messages />}</Route>
        <Route path="/mensajes/:id">{(p) => <Messages id={Number(p.id)} />}</Route>
        <Route path="/admin" component={Admin} />
        <Route path="/compra-segura" component={Safety} />
        <Route>
          <div className="wrap py-16">
            <Empty title="Esta página no existe" action={<Link href="/" className="btn btn-ink">Volver al inicio</Link>}>
              Puede que el enlace esté mal escrito o que la publicación ya no esté.
            </Empty>
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}
