import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack initialRouteName="GetStarted">
      <Stack.Screen name="GetStarted" options={{ headerShown: false }} />
      <Stack.Screen name="Login" options={{ headerShown: false }} />
      <Stack.Screen name="Otp" options={{ headerShown: false }} />
      <Stack.Screen name="Signup" options={{ headerShown: false }} />
    </Stack>
  );
}