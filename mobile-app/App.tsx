import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import ChatScreen from './src/screens/ChatScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <ChatScreen />
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
} 