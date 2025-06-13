import AsyncStorage from '@react-native-async-storage/async-storage';
import { IMessage } from 'react-native-gifted-chat';

const CHAT_HISTORY_KEY = 'chat_history';

export const saveChatHistory = async (messages: IMessage[]): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(messages);
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, jsonValue);
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
};

export const loadChatHistory = async (): Promise<IMessage[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
    if (jsonValue != null) {
      const messages = JSON.parse(jsonValue);
      // Ensure createdAt is a Date object
      return messages.map((msg: any) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      }));
    }
    return [];
  } catch (error) {
    console.error('Error loading chat history:', error);
    return [];
  }
};

export const clearChatHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing chat history:', error);
  }
}; 