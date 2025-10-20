import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/GetStarted');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
