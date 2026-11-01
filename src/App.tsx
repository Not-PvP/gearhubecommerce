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

// The admin dashboard lives at http://localhost:3000/#/admin (no router needed).
const isAdminRoute = () => window.location.hash === "#/admin";

function App() {
  const [adminView, setAdminView] = useState(isAdminRoute());

  useEffect(() => {
    const onHashChange = () => setAdminView(isAdminRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (adminView) {
    return <AdminDashboard />;
  }

  return (
    <>
      <Navbar />

      <div className="app">
        <Hero />
        <Category />
        <FilterBar />
        <ProductGrid />
        <ShoppingCart />
        <Checkout />
        <OrderHistory />
      </div>
    </>
  );
}

export default App;