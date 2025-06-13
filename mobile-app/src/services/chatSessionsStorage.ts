import AsyncStorage from '@react-native-async-storage/async-storage';
import { IMessage } from 'react-native-gifted-chat';
import { ChatSession, ChatSessionPreview } from '../types';

const CHAT_SESSIONS_KEY = 'chat_sessions';
const ACTIVE_SESSION_KEY = 'active_session_id';

// Generate a simple ID
const generateId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// Generate chat title from first message
const generateChatTitle = (messages: IMessage[]): string => {
  const userMessages = messages.filter(msg => msg.user._id === 1);
  if (userMessages.length > 0) {
    const firstMessage = userMessages[userMessages.length - 1].text;
    return firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
  }
  return 'Yeni Sohbet';
};

export const saveChatSessions = async (sessions: ChatSession[]): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(sessions);
    await AsyncStorage.setItem(CHAT_SESSIONS_KEY, jsonValue);
  } catch (error) {
    console.error('Error saving chat sessions:', error);
  }
};

export const loadChatSessions = async (): Promise<ChatSession[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(CHAT_SESSIONS_KEY);
    if (jsonValue != null) {
      const sessions = JSON.parse(jsonValue);
      return sessions.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        })),
      }));
    }
    return [];
  } catch (error) {
    console.error('Error loading chat sessions:', error);
    return [];
  }
};

export const getChatSessionPreviews = async (): Promise<ChatSessionPreview[]> => {
  try {
    const sessions = await loadChatSessions();
    return sessions
      .map(session => ({
        id: session.id,
        title: session.title,
        lastMessage: session.messages.length > 0 ? session.messages[0].text : '',
        updatedAt: session.updatedAt,
        messageCount: session.messages.length,
      }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error) {
    console.error('Error getting chat session previews:', error);
    return [];
  }
};

export const createNewChatSession = async (): Promise<ChatSession> => {
  const welcomeMessage: IMessage = {
    _id: Date.now().toString(),
    text: 'Merhaba, ben CMK Asistanı. Size nasıl yardımcı olabilirim?',
    createdAt: new Date(),
    user: {
      _id: 2,
      name: 'CMK Asistanı',
      avatar: '🤖',
    },
  };

  const newSession: ChatSession = {
    id: generateId(),
    title: 'Yeni Sohbet',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [welcomeMessage],
  };

  const sessions = await loadChatSessions();
  sessions.unshift(newSession);
  await saveChatSessions(sessions);
  await setActiveSessionId(newSession.id);

  return newSession;
};

export const updateChatSession = async (sessionId: string, messages: IMessage[]): Promise<void> => {
  try {
    const sessions = await loadChatSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex !== -1) {
      sessions[sessionIndex].messages = messages;
      sessions[sessionIndex].updatedAt = new Date();
      
      // Update title if this is the first user message
      const userMessages = messages.filter(msg => msg.user._id === 1);
      if (userMessages.length === 1 && sessions[sessionIndex].title === 'Yeni Sohbet') {
        sessions[sessionIndex].title = generateChatTitle(messages);
      }
      
      await saveChatSessions(sessions);
    }
  } catch (error) {
    console.error('Error updating chat session:', error);
  }
};

export const deleteChatSession = async (sessionId: string): Promise<void> => {
  try {
    const sessions = await loadChatSessions();
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    await saveChatSessions(filteredSessions);
    
    // If this was the active session, clear it
    const activeSessionId = await getActiveSessionId();
    if (activeSessionId === sessionId) {
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch (error) {
    console.error('Error deleting chat session:', error);
  }
};

export const getChatSession = async (sessionId: string): Promise<ChatSession | null> => {
  try {
    const sessions = await loadChatSessions();
    return sessions.find(s => s.id === sessionId) || null;
  } catch (error) {
    console.error('Error getting chat session:', error);
    return null;
  }
};

export const setActiveSessionId = async (sessionId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  } catch (error) {
    console.error('Error setting active session ID:', error);
  }
};

export const getActiveSessionId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
  } catch (error) {
    console.error('Error getting active session ID:', error);
    return null;
  }
};

export const clearAllChatSessions = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CHAT_SESSIONS_KEY);
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (error) {
    console.error('Error clearing all chat sessions:', error);
  }
}; 