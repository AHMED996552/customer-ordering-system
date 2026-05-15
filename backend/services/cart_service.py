def get_item(item_id):
    """Stub for repository lookup. Patched in tests."""
    pass

def _get_empty_cart():
    return {
        "cart_id": "cart_tmp",
        "restaurant_id": None,
        "restaurant_name": None,
        "items": [],
        "subtotal_egp": 0.0,
        "item_count": 0,
        "checkout_eligible": False,
        "unavailable_items": []
    }

def refresh_session_cart(session):
    """
    Validates, refreshes prices/availability, and recomputes the cart.
    Updates the session and returns the standardized cart dict.
    """
    raw_cart = session.get('cart')
    
    # Handle corrupted or missing cart
    if not isinstance(raw_cart, dict) or 'items' not in raw_cart:
        session['cart'] = _get_empty_cart()
        return session['cart']
        
    items = raw_cart.get('items', [])
    if not isinstance(items, list):
        items = []

    processed_items = []
    subtotal_egp = 0.0
    item_count = 0
    unavailable_items = []
    
    # Used to aggregate duplicate items and sum their quantities
    item_aggregation = {}

    for line in items:
        # Graceful handling of corrupted line items
        if not isinstance(line, dict):
            continue
            
        item_id = line.get('item_id')
        if not item_id:
            continue
            
        try:
            qty = int(line.get('quantity', 0))
        except (ValueError, TypeError):
            qty = 0
            
        if qty <= 0:
            continue
            
        if item_id in item_aggregation:
            item_aggregation[item_id] += qty
        else:
            item_aggregation[item_id] = qty

    for item_id, qty in item_aggregation.items():
        db_item = get_item(item_id)
        
        # If deleted from DB
        if not db_item:
            unavailable_items.append(item_id)
            # Re-insert stub so it doesn't disappear from the cart silently per REQ20
            processed_items.append({
                "line_item_id": f"li_{item_id}",
                "item_id": item_id,
                "name": "Unknown Item",
                "quantity": qty,
                "unit_price_egp": 0.0,
                "price_egp": 0.0,
                "line_total_egp": 0.0,
                "available": False
            })
            continue
            
        # Re-fetch authoritative state
        price_egp = float(db_item.get('price_egp', 0.0))
        is_available = bool(db_item.get('is_available', False))
        name = db_item.get('name', 'Unknown')
        
        line_total = price_egp * qty
        subtotal_egp += line_total
        item_count += qty
        
        if not is_available:
            unavailable_items.append(item_id)
            
        processed_items.append({
            "line_item_id": f"li_{item_id}", 
            "item_id": item_id,
            "name": name,
            "quantity": qty,
            "unit_price_egp": price_egp,
            "price_egp": price_egp, 
            "line_total_egp": line_total,
            "available": is_available
        })
        
    checkout_eligible = (
        len(processed_items) > 0 and 
        len(unavailable_items) == 0
    )
    
    cart_id = raw_cart.get('cart_id', 'cart_tmp')
    restaurant_id = raw_cart.get('restaurant_id')
    restaurant_name = raw_cart.get('restaurant_name')
    
    updated_cart = {
        "cart_id": cart_id,
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant_name,
        "items": processed_items,
        "subtotal_egp": subtotal_egp,
        "item_count": item_count,
        "checkout_eligible": checkout_eligible,
        "unavailable_items": unavailable_items
    }
    
    session['cart'] = updated_cart
    return updated_cart
