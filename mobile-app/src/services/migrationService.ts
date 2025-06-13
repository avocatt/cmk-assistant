import AsyncStorage from '@react-native-async-storage/async-storage';
import { IMessage } from 'react-native-gifted-chat';
import { createNewChatSession, saveChatSessions } from './chatSessionsStorage';
import { ChatSession } from '../types';

const MIGRATION_KEY = 'migration_completed';
const OLD_CHAT_HISTORY_KEY = 'chat_history';

export const runMigration = async (): Promise<void> => {
  try {
    // Check if migration has already been completed
    const migrationCompleted = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrationCompleted) {
      return;
    }

    console.log('Running migration from single chat to multi-chat...');

    // Check if there's old chat history
    const oldChatHistory = await AsyncStorage.getItem(OLD_CHAT_HISTORY_KEY);
    
    if (oldChatHistory) {
      const oldMessages: IMessage[] = JSON.parse(oldChatHistory).map((msg: any) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      }));

      if (oldMessages.length > 0) {
        // Create a new session with the old messages
        const migratedSession: ChatSession = {
          id: Date.now().toString() + '_migrated',
          title: generateTitleFromMessages(oldMessages),
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: oldMessages,
        };

        // Save the migrated session
        await saveChatSessions([migratedSession]);
        await AsyncStorage.setItem('active_session_id', migratedSession.id);

        console.log('Migration completed: Created session from old chat history');
      }

      // Remove old chat history
      await AsyncStorage.removeItem(OLD_CHAT_HISTORY_KEY);
    }

    // Mark migration as completed
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

const generateTitleFromMessages = (messages: IMessage[]): string => {
  const userMessages = messages.filter(msg => msg.user._id === 1);
  if (userMessages.length > 0) {
    const firstMessage = userMessages[userMessages.length - 1].text;
    return firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
  }
  return 'Geçmiş Sohbet';
}; 