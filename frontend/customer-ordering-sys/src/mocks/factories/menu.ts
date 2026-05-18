// Mock data mirroring the UC-2 API Contract

export const MOCK_MENU_SUCCESS_RESPONSE = {
  restaurant: {
    restaurant_id: "R001",
    name: "Burger Palace",
    is_open: true
  },
  menu: [
    {
      category: "Burgers",
      items: [
        {
          item_id: "I001",
          name: "Classic Burger",
          description: "Beef patty, lettuce, tomato, house sauce.",
          price_egp: 75.00,
          available: true
        },
        {
          item_id: "I003",
          name: "Unavailable Special",
          description: "Chef's secret recipe.",
          price_egp: 50.00,
          available: false
        }
      ]
    },
    {
      category: "Sides",
      items: [
        {
          item_id: "I004",
          name: "Loaded Fries",
          description: "Fries with cheese and jalapenos.",
          price_egp: 45.00,
          available: true
        }
      ]
    }
  ],
  server_utc_time_at_request: "2026-05-10T14:00:00Z"
};

export const MOCK_RESTAURANT_CLOSED_RESPONSE = {
  error: {
    code: "RESTAURANT_CLOSED",
    message: "Burger Palace is currently closed and cannot accept orders.",
    details: {
      restaurant_id: "R001",
      operating_hours_utc: {
        open: "10:00",
        close: "22:00"
      },
      server_utc_time_at_request: "03:00"
    }
  }
};

export const MOCK_RESTAURANT_NOT_FOUND_RESPONSE = {
  error: {
    code: "RESTAURANT_NOT_FOUND",
    message: "No restaurant exists with the provided ID."
  }
};
