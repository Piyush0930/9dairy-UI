import { Slot } from 'expo-router';
import { CartProvider } from '@/contexts/CartContext';

export default function RootLayout() {
  return (
    <CartProvider>
      <Slot />
    </CartProvider>
  );
}
