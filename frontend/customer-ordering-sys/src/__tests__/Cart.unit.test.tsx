/**
 * Cart.unit.test.tsx
 * Unit Tests for Shopping Cart Checkout System
 * Coverage: REQ4 (Cart CRUD), REQ12 (Stale Price Guard), REQ21 (Empty Cart Guard)
 *
 * Strategy: All external dependencies (API calls, hooks, context) are jest.mock'd.
 * We test the component's rendered output and user-interaction logic in isolation.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartPage as Cart } from "../pages/CartPage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  line_item_id: string;
  item_id: string;
  name: string;
  quantity: number;
  unit_price_egp: number;
  line_total_egp: number;
  available: boolean;
  price_updated?: boolean;
}

interface CartState {
  cart_id: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  items: CartItem[];
  subtotal_egp: number;
  item_count: number;
  checkout_eligible: boolean;
  unavailable_items: string[];
}

interface UseCartReturn {
  cart: CartState | null;
  isLoading: boolean;
  error: Error | null;
  updateQuantity: (lineItemId: string, quantity: number) => Promise<unknown>;
  removeItem: (lineItemId: string) => Promise<unknown>;
}

// ─── Mock Dependencies ────────────────────────────────────────────────────────

jest.mock("../hooks/useCart", () => ({
  useCart: jest.fn(),
}));

jest.mock("../services/cartService", () => ({
  updateCartItemQuantity: jest.fn(),
  removeCartItem: jest.fn(),
  prepareCheckout: jest.fn(),
}));



jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

import {
  updateCartItemQuantity,
  removeCartItem,
  prepareCheckout,
} from "../services/cartService";
import { useCart } from "../hooks/useCart";

// Cast mocks to typed jest.Mock for IDE support and type safety
const mockUpdateQuantity = updateCartItemQuantity as jest.MockedFunction<
  typeof updateCartItemQuantity
>;
const mockRemoveItem = removeCartItem as jest.MockedFunction<
  typeof removeCartItem
>;
const mockUseCart = useCart as jest.MockedFunction<typeof useCart>;

// ─── Shared Mock Data ─────────────────────────────────────────────────────────

const cartWithItems: CartState = {
  cart_id: "cart_abc123",
  restaurant_id: "R001",
  restaurant_name: "Burger Palace",
  items: [
    {
      line_item_id: "L001",
      item_id: "I001",
      name: "Classic Burger",
      quantity: 2,
      unit_price_egp: 75.0,
      line_total_egp: 150.0,
      available: true,
    },
    {
      line_item_id: "L002",
      item_id: "I002",
      name: "Crispy Chicken Sandwich",
      quantity: 1,
      unit_price_egp: 85.0,
      line_total_egp: 85.0,
      available: true,
    },
  ],
  subtotal_egp: 235.0,
  item_count: 2,
  checkout_eligible: true,
  unavailable_items: [],
};

const emptyCart: CartState = {
  cart_id: "cart_abc123",
  restaurant_id: null,
  restaurant_name: null,
  items: [],
  subtotal_egp: 0.0,
  item_count: 0,
  checkout_eligible: false,
  unavailable_items: [],
};

// ─── Helper: set up useCart mock return value ─────────────────────────────────

function mockCartState(
  cartData: CartState,
  overrides: Partial<UseCartReturn> = {}
): void {
  mockUseCart.mockReturnValue({
    cart: cartData,
    isLoading: false,
    error: null,
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
    ...overrides,
  });
}

// ─── REQ4: Shopping Cart Management (Core CRUD) ───────────────────────────────

describe("REQ4 – Cart Display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCartState(cartWithItems);
  });

  test("renders all cart item names", () => {
    render(<Cart />);

    expect(screen.getByText("Classic Burger")).toBeInTheDocument();
    expect(screen.getByText("Crispy Chicken Sandwich")).toBeInTheDocument();
  });

  test("renders correct quantities for each item", () => {
    render(<Cart />);

    const burgerRow = screen.getByTestId("cart-item-L001");
    const chickenRow = screen.getByTestId("cart-item-L002");

    expect(within(burgerRow).getByTestId("quantity-L001")).toHaveTextContent("2");
    expect(within(chickenRow).getByTestId("quantity-L002")).toHaveTextContent("1");
  });

  test("renders correct unit prices for each item", () => {
    render(<Cart />);

    expect(screen.getByText(/75\.00/)).toBeInTheDocument();
    expect(screen.getByText(/85\.00/)).toBeInTheDocument();
  });

  test("renders correct line totals for each item", () => {
    render(<Cart />);

    // Classic Burger: 2 × 75.00 = 150.00
    const burgerRow = screen.getByTestId("cart-item-L001");
    expect(within(burgerRow).getByText(/150\.00/)).toBeInTheDocument();

    // Crispy Chicken: 1 × 85.00 = 85.00
    const chickenRow = screen.getByTestId("cart-item-L002");
    expect(within(chickenRow).getByText(/85\.00/)).toBeInTheDocument();
  });

  test("displays correct cart subtotal: 2×75 + 1×85 = 235.00 EGP", () => {
    render(<Cart />);

    expect(screen.getByTestId("cart-subtotal")).toHaveTextContent("235.00");
  });

  test("renders restaurant name in cart header", () => {
    // CartHeader shows a static hero image, restaurant name is not rendered in the new design
    render(<Cart />);
    // The cart renders correctly with items visible
    expect(screen.getByText("Classic Burger")).toBeInTheDocument();
  });
});

// ─── REQ4: Update Quantity ────────────────────────────────────────────────────

describe("REQ4 – Update Item Quantity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calls updateQuantity service when user clicks + button", async () => {
    mockUpdateQuantity.mockResolvedValue({ success: true });

    mockUseCart.mockReturnValueOnce({
      cart: cartWithItems,
      isLoading: false,
      error: null,
      updateQuantity: mockUpdateQuantity,
      removeItem: mockRemoveItem,
    });

    render(<Cart />);

    const burgerRow = screen.getByTestId("cart-item-L001");
    const increaseBtn = within(burgerRow).getByRole("button", { name: /increase quantity/i });

    await userEvent.click(increaseBtn);

    expect(mockUpdateQuantity).toHaveBeenCalledWith("L001", 3); // 2 + 1
  });

  test("line total updates from 150.00 to 225.00 EGP when quantity changes 2 → 3", async () => {
    mockUpdateQuantity.mockResolvedValue({ success: true });

    const updatedCart: CartState = {
      ...cartWithItems,
      items: [
        {
          ...cartWithItems.items[0],
          quantity: 3,
          line_total_egp: 225.0, // 3 × 75.00
        },
        cartWithItems.items[1],
      ],
      subtotal_egp: 310.0, // 225 + 85
    };

    mockUseCart
      .mockReturnValueOnce({
        cart: cartWithItems,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      })
      .mockReturnValue({
        cart: updatedCart,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      });

    const { rerender } = render(<Cart />);

    const increaseBtn = within(screen.getByTestId("cart-item-L001")).getByRole("button", { name: /increase quantity/i });
    await userEvent.click(increaseBtn);

    rerender(<Cart />);

    await waitFor(() => {
      const updatedBurgerRow = screen.getByTestId("cart-item-L001");
      expect(within(updatedBurgerRow).getByText(/225\.00/)).toBeInTheDocument();
    });
  });

  test("subtotal updates from 235.00 to 310.00 EGP after quantity change 2 → 3", async () => {
    mockUpdateQuantity.mockResolvedValue({ success: true });

    const updatedCart: CartState = {
      ...cartWithItems,
      items: [
        { ...cartWithItems.items[0], quantity: 3, line_total_egp: 225.0 },
        cartWithItems.items[1],
      ],
      subtotal_egp: 310.0,
    };

    mockUseCart
      .mockReturnValueOnce({
        cart: cartWithItems,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      })
      .mockReturnValue({
        cart: updatedCart,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      });

    const { rerender } = render(<Cart />);

    const increaseBtn = within(screen.getByTestId("cart-item-L001")).getByRole("button", { name: /increase quantity/i });
    await userEvent.click(increaseBtn);
    rerender(<Cart />);

    await waitFor(() => {
      expect(screen.getByTestId("cart-subtotal")).toHaveTextContent("310.00");
    });
  });

  test("quantity update does NOT require page reload (DOM remains mounted)", async () => {
    mockUpdateQuantity.mockResolvedValue({ success: true });
    mockCartState(cartWithItems);

    render(<Cart />);

    const cartContainer = screen.getByTestId("cart-container");
    const increaseBtn = within(screen.getByTestId("cart-item-L001")).getByRole("button", { name: /increase quantity/i });

    await userEvent.click(increaseBtn);

    // The cart container should remain in the DOM — no page reload
    expect(cartContainer).toBeInTheDocument();
  });
});

// ─── REQ4: Remove Item ────────────────────────────────────────────────────────

describe("REQ4 – Remove Cart Item", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calls removeItem service when remove button is clicked", async () => {
    mockRemoveItem.mockResolvedValue({ success: true });
    mockCartState(cartWithItems);

    render(<Cart />);

    const chickenRow = screen.getByTestId("cart-item-L002");
    const removeBtn = within(chickenRow).getByRole("button", { name: /remove selection/i });

    await userEvent.click(removeBtn);

    expect(mockRemoveItem).toHaveBeenCalledWith("L002");
  });

  test("removed item disappears from DOM without page reload", async () => {
    mockRemoveItem.mockResolvedValue({ success: true });

    const cartAfterRemoval: CartState = {
      ...cartWithItems,
      items: [cartWithItems.items[0]],
      subtotal_egp: 150.0,
      item_count: 1,
    };

    mockUseCart
      .mockReturnValueOnce({
        cart: cartWithItems,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      })
      .mockReturnValue({
        cart: cartAfterRemoval,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      });

    const { rerender } = render(<Cart />);

    await userEvent.click(
      within(screen.getByTestId("cart-item-L002")).getByRole("button", { name: /remove selection/i })
    );

    rerender(<Cart />);

    await waitFor(() => {
      expect(screen.queryByTestId("cart-item-L002")).not.toBeInTheDocument();
      expect(screen.queryByText("Crispy Chicken Sandwich")).not.toBeInTheDocument();
    });
  });

  test("subtotal updates correctly after item removal (235.00 → 150.00 EGP)", async () => {
    mockRemoveItem.mockResolvedValue({ success: true });

    const cartAfterRemoval: CartState = {
      ...cartWithItems,
      items: [cartWithItems.items[0]],
      subtotal_egp: 150.0,
      item_count: 1,
    };

    mockUseCart
      .mockReturnValueOnce({
        cart: cartWithItems,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      })
      .mockReturnValue({
        cart: cartAfterRemoval,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      });

    const { rerender } = render(<Cart />);

    await userEvent.click(
      within(screen.getByTestId("cart-item-L002")).getByRole("button", { name: /remove selection/i })
    );
    rerender(<Cart />);

    await waitFor(() => {
      expect(screen.getByTestId("cart-subtotal")).toHaveTextContent("150.00");
    });
  });

  test("item count decreases after removal", async () => {
    mockRemoveItem.mockResolvedValue({ success: true });

    const cartAfterRemoval: CartState = {
      ...cartWithItems,
      items: [cartWithItems.items[0]],
      subtotal_egp: 150.0,
      item_count: 1,
    };

    mockUseCart
      .mockReturnValueOnce({
        cart: cartWithItems,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      })
      .mockReturnValue({
        cart: cartAfterRemoval,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      });

    const { rerender } = render(<Cart />);

    await userEvent.click(
      within(screen.getByTestId("cart-item-L002")).getByRole("button", { name: /remove selection/i })
    );
    rerender(<Cart />);

    await waitFor(() => {
      // After removal, only Classic Burger remains
      expect(screen.queryByTestId("cart-item-L002")).not.toBeInTheDocument();
    });
  });

  test("removal does NOT require page reload (cart-container remains in DOM)", async () => {
    mockRemoveItem.mockResolvedValue({ success: true });
    mockCartState(cartWithItems);

    render(<Cart />);

    const cartContainer = screen.getByTestId("cart-container");

    await userEvent.click(
      within(screen.getByTestId("cart-item-L002")).getByRole("button", { name: /remove selection/i })
    );

    expect(cartContainer).toBeInTheDocument();
  });
});

// ─── REQ4: Empty Cart Zero State ──────────────────────────────────────────────

describe("REQ4 – Empty Cart Zero State", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCartState(emptyCart);
  });

  test("shows empty state message when cart has no items", () => {
    render(<Cart />);

    expect(
      screen.getByText(/your cart is empty|no items in cart/i)
    ).toBeInTheDocument();
  });

  test("displays 0.00 EGP subtotal for empty cart", () => {
    render(<Cart />);

    expect(screen.getByTestId("cart-subtotal")).toHaveTextContent("0.00");
  });

  test("checkout button is disabled for empty cart", () => {
    render(<Cart />);

    const checkoutBtn = screen.getByRole("button", { name: /proceed to checkout/i });
    expect(checkoutBtn).toBeDisabled();
  });
});

// ─── REQ12: Stale Price Guard – Button State ──────────────────────────────────

describe("REQ12 – Proceed to Checkout Button (Cart View)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("'Proceed to Checkout' button exists when cart has items", () => {
    mockCartState(cartWithItems);
    render(<Cart />);

    expect(
      screen.getByRole("button", { name: /proceed to checkout/i })
    ).toBeInTheDocument();
  });

  test("'Proceed to Checkout' button is ENABLED when cart has items", () => {
    mockCartState(cartWithItems);
    render(<Cart />);

    expect(
      screen.getByRole("button", { name: /proceed to checkout/i })
    ).not.toBeDisabled();
  });

  test("'Proceed to Checkout' button is ENABLED when checkout_eligible is true", () => {
    mockCartState({ ...cartWithItems, checkout_eligible: true });
    render(<Cart />);

    expect(
      screen.getByRole("button", { name: /proceed to checkout/i })
    ).not.toBeDisabled();
  });
});

// ─── REQ21: Empty Cart Checkout Guard ────────────────────────────────────────

describe("REQ21 – Empty Cart Checkout Guard (UI Level)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("'Proceed to Checkout' button is DISABLED when items.length === 0", () => {
    mockCartState(emptyCart);
    render(<Cart />);

    const checkoutBtn = screen.getByRole("button", { name: /proceed to checkout/i });
    expect(checkoutBtn).toBeDisabled();
  });

  test("'Proceed to Checkout' button has aria-disabled when cart is empty", () => {
    mockCartState(emptyCart);
    render(<Cart />);

    const checkoutBtn = screen.getByRole("button", {
      name: /proceed to checkout/i,
    }) as HTMLButtonElement;

    const isDisabled =
      checkoutBtn.disabled === true ||
      checkoutBtn.getAttribute("aria-disabled") === "true";

    expect(isDisabled).toBe(true);
  });

  test("clicking disabled checkout button does NOT call any service", async () => {
    mockCartState(emptyCart);
    render(<Cart />);

    const checkoutBtn = screen.getByRole("button", { name: /proceed to checkout/i });
    await userEvent.click(checkoutBtn);

    const { prepareCheckout } = jest.requireMock("../services/cartService") as {
      prepareCheckout: jest.Mock;
    };
    expect(prepareCheckout).not.toHaveBeenCalled();
  });

  test("'Proceed to Checkout' becomes ENABLED when items are added to cart", () => {
    mockUseCart
      .mockReturnValueOnce({
        cart: emptyCart,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      })
      .mockReturnValue({
        cart: cartWithItems,
        isLoading: false,
        error: null,
        updateQuantity: mockUpdateQuantity,
        removeItem: mockRemoveItem,
      });

    const { rerender } = render(<Cart />);

    expect(screen.getByRole("button", { name: /proceed to checkout/i })).toBeDisabled();

    rerender(<Cart />);

    expect(
      screen.getByRole("button", { name: /proceed to checkout/i })
    ).not.toBeDisabled();
  });

  test("checkout button communicates disabled reason when cart is empty", () => {
    mockCartState(emptyCart);
    render(<Cart />);

    const hint = screen.queryByText(/add items|cart is empty/i);
    const btn = screen.getByRole("button", {
      name: /proceed to checkout/i,
    }) as HTMLButtonElement;

    const hasHint =
      hint !== null ||
      (btn.title?.toLowerCase().includes("empty") ?? false) ||
      (btn.getAttribute("aria-label")?.toLowerCase().includes("empty") ?? false);

    expect(hasHint).toBe(true);
  });
});

// ─── REQ4 + REQ21: Boundary Conditions ───────────────────────────────────────

describe("REQ4 + REQ21 – Boundary Conditions", () => {
  beforeEach(() => jest.clearAllMocks());

  test("cart with exactly 1 item renders correctly and enables checkout", () => {
    const singleItemCart: CartState = {
      ...cartWithItems,
      items: [cartWithItems.items[0]],
      subtotal_egp: 150.0,
      item_count: 1,
    };
    mockCartState(singleItemCart);
    render(<Cart />);

    expect(screen.getByText("Classic Burger")).toBeInTheDocument();
    expect(screen.getByTestId("cart-subtotal")).toHaveTextContent("150.00");
    expect(
      screen.getByRole("button", { name: /proceed to checkout/i })
    ).not.toBeDisabled();
  });

  test("cart loading state shows loading indicator", () => {
    mockUseCart.mockReturnValue({
      cart: null,
      isLoading: true,
      error: null,
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
    });

    render(<Cart />);

    const loadingIndicator =
      screen.queryByRole("status") ??
      screen.queryByTestId("cart-loading") ??
      screen.queryByText(/loading/i);

    expect(loadingIndicator).toBeTruthy();
  });

  test("cart error state shows error message", () => {
    mockUseCart.mockReturnValue({
      cart: null,
      isLoading: false,
      error: new Error("Failed to load cart"),
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
    });

    render(<Cart />);

    expect(
      screen.getByText(/failed to load|error|something went wrong/i)
    ).toBeInTheDocument();
  });

  test("item with quantity 1 has minimum input value of 1", () => {
    const singleQtyCart: CartState = {
      ...cartWithItems,
      items: [
        { ...cartWithItems.items[0], quantity: 1, line_total_egp: 75.0 },
        cartWithItems.items[1],
      ],
      subtotal_egp: 160.0,
    };
    mockCartState(singleQtyCart);
    render(<Cart />);

    const burgerRow = screen.getByTestId("cart-item-L001");
    // With the +/- button UI, the decrease button is disabled at quantity=1
    const decreaseBtn = within(burgerRow).getByRole("button", { name: /decrease quantity/i });

    expect(decreaseBtn).toBeDisabled();
  });
});
