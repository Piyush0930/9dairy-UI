// app/(superadmin)/index.jsx - FIXED VERSION
import { Redirect } from 'expo-router';

export default function SuperAdminIndex() {
  return <Redirect href="/(superadmin)/dashboard" />; // ✅ This should work
}