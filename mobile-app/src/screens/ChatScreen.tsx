import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { IconButton, Appbar } from 'react-native-paper';
import { GiftedChat, IMessage, InputToolbar, Send } from 'react-native-gifted-chat';
import { askAI } from '../services/api';
import { ChatSession } from '../types';
import {
  createNewChatSession,
  getChatSession,
  updateChatSession,
  getActiveSessionId,
  setActiveSessionId,
} from '../services/chatSessionsStorage';
import ChatDrawerLayout from '../components/ChatDrawerLayout';

const ChatScreen = () => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    // Try to load the active session
    const activeSessionId = await getActiveSessionId();
    
    if (activeSessionId) {
      const session = await getChatSession(activeSessionId);
      if (session) {
        setCurrentSession(session);
        setMessages(session.messages);
        return;
      }
    }
    
    // If no active session or session not found, create a new one
    await handleNewChat();
  };

  const handleNewChat = async () => {
    const newSession = await createNewChatSession();
    setCurrentSession(newSession);
    setMessages(newSession.messages);
    setIsDrawerOpen(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSessionSelect = async (sessionId: string) => {
    const session = await getChatSession(sessionId);
    if (session) {
      setCurrentSession(session);
      setMessages(session.messages);
      await setActiveSessionId(sessionId);
    }
  };

  // Save messages to current session whenever messages change
  useEffect(() => {
    if (currentSession && messages.length > 0) {
      updateChatSession(currentSession.id, messages);
    }
  }, [messages, currentSession]);

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    const userMessage = newMessages[0];
    if (!userMessage.text.trim() || isLoading || !currentSession) return;

    // Add user message
    setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));

    // Create AI placeholder message
    const aiMessagePlaceholder: IMessage = {
      _id: (Date.now() + 1).toString(),
      text: '',
      createdAt: new Date(),
      user: {
        _id: 2,
        name: 'CMK Asistanı',
        avatar: '🤖',
      },
    };

    setMessages(previousMessages => GiftedChat.append(previousMessages, [aiMessagePlaceholder]));
    setIsLoading(true);

    try {
      console.log('Sending question to AI:', userMessage.text);
      const result = await askAI(userMessage.text);
      console.log('AI response received:', result);
      
      // Update the AI message with the complete response
      const aiMessage: IMessage = {
        ...aiMessagePlaceholder,
        text: result.answer,
      };

      setMessages(prev => prev.map(msg => 
        msg._id === aiMessagePlaceholder._id ? aiMessage : msg
      ));

      setIsLoading(false);

      // Log sources for debugging
      console.log('Sources:', result.sources);
    } catch (error) {
      console.error('ChatScreen error:', error);
      const errorMessage: IMessage = {
        _id: Date.now().toString(),
        text: 'Üzgünüm, bir hata oluştu.',
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'CMK Asistanı',
          avatar: '🤖',
        },
      };
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
      setIsLoading(false);
    }
  }, [isLoading, currentSession]);

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const renderInputToolbar = (props: any) => (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbar}
      primaryStyle={styles.inputPrimary}
    />
  );

  const renderSend = (props: any) => (
    <Send {...props}>
      <View style={styles.sendContainer}>
        <IconButton icon="send" size={24} iconColor="#007AFF" />
      </View>
    </Send>
  );

  const renderChat = () => (
    <View style={styles.chatContainer}>
      <Appbar.Header>
        <Appbar.Action 
          icon="menu" 
          onPress={toggleDrawer}
        />
        <Appbar.Content 
          title={currentSession?.title || 'CMK Asistanı'} 
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action 
          icon="plus" 
          onPress={handleNewChat}
          iconColor="#007AFF"
        />
      </Appbar.Header>
      
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{
          _id: 1,
        }}
        renderInputToolbar={renderInputToolbar}
        renderSend={renderSend}
        placeholder="Mesajınızı yazın..."
        isTyping={isLoading}
        showUserAvatar={false}
        showAvatarForEveryMessage={true}
        alwaysShowSend
        scrollToBottom
        inverted
        locale="tr"
        timeFormat="HH:mm"
        dateFormat="DD.MM.YYYY"
        messagesContainerStyle={styles.messagesContainer}
      />
    </View>
  );

  return (
    <ChatDrawerLayout
      activeSessionId={currentSession?.id || null}
      onSessionSelect={handleSessionSelect}
      onNewChat={handleNewChat}
      isDrawerOpen={isDrawerOpen}
      onDrawerToggle={toggleDrawer}
      refreshTrigger={refreshTrigger}
    >
      {renderChat()}
    </ChatDrawerLayout>
  );
};

const styles = StyleSheet.create({
  chatContainer: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  messagesContainer: {
    backgroundColor: '#F7F7F7',
  },
  inputToolbar: {
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputPrimary: {
    alignItems: 'center',
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
});

export default ChatScreen; 