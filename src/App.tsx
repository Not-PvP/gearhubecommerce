import { useEffect, useState } from "react";
import ProductGrid from "./components/ProductGrid/ProductGrid";
import Navbar from "./components/Navbar/Navbar";
import Hero from "./components/Hero/Hero";
import Category from "./components/Category/Category";
import FilterBar from "./components/FilterBar/FilterBar";
import ShoppingCart from "./components/ShoppingCart/ShoppingCart";
import Checkout from "./components/Checkout/Checkout";
import OrderHistory from "./components/OrderHistory/OrderHistory";
import AdminDashboard from "./components/AdminDashboard/AdminDashboard";
import AuthModal from "./components/AuthModal/AuthModal";
import CartToast from "./components/CartToast/CartToast";
import { useCard } from "./state/CardContext";

const isAdminRoute = () => window.location.hash === "#/admin";

function App() {
  const [adminView, setAdminView] = useState(isAdminRoute());
  const { state } = useCard();
  const isAdmin = Boolean(state.user?.isAdmin);

  useEffect(() => {
    const onHashChange = () => setAdminView(isAdminRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // admin accounts only manage the store: keep them on the dashboard
  useEffect(() => {
    if (isAdmin && !isAdminRoute()) window.location.hash = "#/admin";
  }, [isAdmin, adminView]);

  if (adminView || isAdmin) {
    return <AdminDashboard />;
  }

  return (
    <>
      <Navbar />

      <main className="app">
        <Hero />
        <section className="shop" id="shop" aria-label="Shop">
          <Category />
          <FilterBar />
          <ProductGrid />
        </section>
        <ShoppingCart />
        <Checkout />
        <OrderHistory />
        <AuthModal />
        <CartToast />
      </main>
    </>
  );
}

export default App;