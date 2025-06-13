import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, IconButton } from 'react-native-paper';
import { GiftedChat, IMessage, InputToolbar, Send, Actions } from 'react-native-gifted-chat';
import * as Speech from 'expo-speech';
import { askAI } from '../services/api';
import { useSpeechToText } from '../hooks/useSpeechToText';

const ChatScreen = () => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isRecording, startRecording, stopRecordingAndTranscribe } = useSpeechToText();

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
    Speech.speak(welcomeMessage.text, { language: 'tr-TR' });
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
      Speech.speak(result.answer, { language: 'tr-TR' });

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

  const handleVoiceButtonPress = async () => {
    if (isLoading) return;
    if (isRecording) {
      const transcribedText = await stopRecordingAndTranscribe();
      if (transcribedText) {
        const voiceMessage: IMessage = {
          _id: Date.now().toString(),
          text: transcribedText,
          createdAt: new Date(),
          user: {
            _id: 1,
          },
        };
        onSend([voiceMessage]);
      }
    } else {
      await startRecording();
    }
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

  const renderActions = (props: any) => (
    <Actions
      {...props}
      containerStyle={styles.actionsContainer}
      onPressActionButton={handleVoiceButtonPress}
      icon={() => (
        <IconButton
          icon={isRecording ? "stop-circle-outline" : "microphone"}
          size={24}
          iconColor={isRecording ? "#FF0000" : "#007AFF"}
        />
      )}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="CMK Asistanı" />
      </Appbar.Header>

      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{
          _id: 1,
        }}
        renderInputToolbar={renderInputToolbar}
        renderSend={renderSend}
        renderActions={renderActions}
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
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
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
  actionsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 8,
  },
});

export default ChatScreen; 