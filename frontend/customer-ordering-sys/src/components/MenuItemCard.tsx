import React, { useState } from 'react';
import QuantitySelector from './QuantitySelector';
import { useCart } from '../context/CartContext';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  image?: string;
  description?: string;
}

interface MenuItemCardProps {
  item: MenuItem;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const isInvalid = quantity < 1;

  const handleAdd = () => {
    if (isInvalid) return;
    addItem({ id: item.id, name: item.name, price: item.price, quantity });
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {item.image && (
        <img src={item.image} alt={item.name} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12 }} />
      )}
      <div style={{ padding: '16px 4px 4px' }}>
        <h3 style={{ margin: '0 0 4px' }}>{item.name}</h3>
        {item.description && <p style={{ fontSize: '0.85rem' }}>{item.description}</p>}
        <p style={{ fontWeight: 700, margin: '8px 0' }}>{item.price} EGP</p>

        {item.available ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <button
              className="btn-primary"
              onClick={handleAdd}
              disabled={isInvalid}
              aria-label="Add to Cart"
            >
              Add to Cart
            </button>
          </div>
        ) : (
          <button className="btn-primary" disabled aria-label="Unavailable">
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
};

export default MenuItemCard;
