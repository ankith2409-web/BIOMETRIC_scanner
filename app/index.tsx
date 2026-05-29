import { Redirect } from 'expo-router';
import { storageService } from '../services/storageService';

export default function Index() {
  const loggedInUser = storageService.getLoggedInUser();
  
  if (loggedInUser) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/login" />;
  }
}
