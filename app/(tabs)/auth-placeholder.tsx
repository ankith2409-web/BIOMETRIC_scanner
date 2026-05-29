import { Redirect } from 'expo-router';

// This tab redirects to the full-screen authenticate screen
export default function AuthPlaceholder() {
  return <Redirect href="/authenticate" />;
}
