import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from 'react-native-paper';
import { GiftedChat, IMessage, InputToolbar, Send } from 'react-native-gifted-chat';
import { askAI } from '../services/api';

const ChatScreen = () => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Welcome message
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
    setMessages([welcomeMessage]);
  }, []);

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    const userMessage = newMessages[0];
    if (!userMessage.text.trim() || isLoading) return;

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
  }, [isLoading]);



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



  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
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