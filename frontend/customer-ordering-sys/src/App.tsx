import React from 'react';
import OrderTrackingPage from './pages/OrderTrackingPage';

function App() {
  // Read orderId from the URL (e.g. ?orderId=ORD-20260510-001) or default to a dummy one
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId') || 'ORD-20260510-001';

  return (
    <div className="App">
      <OrderTrackingPage orderId={orderId} />
    </div>
  );
}

export default App;
