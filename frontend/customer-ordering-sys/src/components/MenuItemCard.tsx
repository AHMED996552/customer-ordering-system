import React, { useState } from 'react';
import QuantitySelector from './QuantitySelector';
import { useCart } from '../context/CartContext';
import { addToCart } from '../services/cartApi';
import './MenuItemCard.css';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  image?: string;
  description?: string;
  category?: string;
}

interface MenuItemCardProps {
  item: MenuItem;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const isInvalid = quantity < 1;

  const handleAdd = async () => {
    if (isInvalid) return;

    try {
      // 1. Send the request to the Flask backend
      await addToCart({ itemId: item.id, quantity });
      
      // 2. Update the local React state
      addItem({ id: item.id, name: item.name, price: item.price, quantity });
      setQuantity(1);
    } catch (err: any) {
      console.error("Failed to add to cart:", err);
      // Show the exact backend error to the user
      alert(err.message || "Failed to add item to cart. Please check the console.");
    }
  };

  return (
    <div className={`card menu-item-card fade-up ${!item.available ? 'menu-item-card--unavailable' : ''}`}>
      {/* Image */}
      <div className="menu-item-card__img-wrap">
        {item.image ? (
          <img src={item.image} alt={item.name} className="menu-item-card__img" />
        ) : (
          <div className="menu-item-card__img-placeholder">🍽</div>
        )}
      </div>

      {/* Body */}
      <div className="menu-item-card__body">
        <h3 className="menu-item-card__name">{item.name}</h3>
        {item.description && (
          <p className="menu-item-card__desc">{item.description}</p>
        )}
        <p className="menu-item-card__price">{item.price} EGP</p>

        <div className="menu-item-card__footer">
          {item.available ? (
            <>
              <QuantitySelector value={quantity} onChange={setQuantity} />
              <button
                className="btn-primary"
                onClick={handleAdd}
                disabled={isInvalid}
                aria-label="Add to Cart"
              >
                Add to Cart
              </button>
            </>
          ) : (
            <button className="btn-primary" disabled aria-label="Unavailable">
              Unavailable
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuItemCard;
