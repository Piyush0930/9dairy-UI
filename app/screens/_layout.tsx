import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack initialRouteName="GetStarted">  {/* use the actual file name */}
      <Stack.Screen name="GetStarted" options={{ headerShown: false }} />
      <Stack.Screen name="Login" options={{ headerShown: false }} />
    </Stack>
  );
}
