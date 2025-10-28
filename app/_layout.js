import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { Slot } from 'expo-router';

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <Slot />
      </CartProvider>
    </AuthProvider>
  );
}
