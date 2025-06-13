import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import ChatScreen from './src/screens/ChatScreen';
import { runMigration } from './src/services/migrationService';

export default function App() {
  useEffect(() => {
    runMigration();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <ChatScreen />
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
} 