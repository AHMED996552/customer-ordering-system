import React from 'react';
import './App.css';
import SecureCheckoutPayment from './pages/SecureCheckoutPayment';
import Header from './components/Header';
import Footer from './components/Footer';

const CART_ITEMS = [
  { id: 'I001', name: 'The Chef\'s Tasting Menu', qty: 1, price: 325.00 },
  { id: 'I003', name: 'Elite Wine Pairing', qty: 1, price: 180.00 },
];

function App() {
  const handleOrderConfirmed = (order: any) => {
    console.log('Order Confirmed:', order);
    alert(`Order ${order.id} confirmed!`);
  };

  return (
    <div className="bg-background text-on-background font-body-md selection:bg-primary/30 min-h-screen overflow-x-hidden">
      <Header />

      <main className="max-w-container-max mx-auto px-md md:px-lg py-xl">
        <SecureCheckoutPayment
          cartItems={CART_ITEMS}
          onOrderConfirmed={handleOrderConfirmed}
        />
      </main>

      <Footer />
    </div>
  );
}

export default App;
