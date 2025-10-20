export const orders = [
  {
    id: "ORD001",
    date: "2025-10-18",
    status: "delivered",
    items: [
      { productName: "Fresh Cow Milk", quantity: 2, price: 65 },
      { productName: "Amul Butter", quantity: 1, price: 55 },
    ],
    total: 185,
  },
  {
    id: "ORD002",
    date: "2025-10-17",
    status: "out_for_delivery",
    items: [
      { productName: "Paneer", quantity: 1, price: 90 },
      { productName: "Greek Yogurt", quantity: 2, price: 75 },
    ],
    total: 240,
  },
  {
    id: "ORD003",
    date: "2025-10-15",
    status: "delivered",
    items: [
      { productName: "Cheddar Cheese", quantity: 1, price: 120 },
      { productName: "Vanilla Ice Cream", quantity: 1, price: 180 },
    ],
    total: 300,
  },
];