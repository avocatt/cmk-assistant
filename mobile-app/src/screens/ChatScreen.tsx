import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, TextInput, Button, ActivityIndicator, Text } from 'react-native-paper';
import * as Speech from 'expo-speech';
import { Message } from '../types';
import MessageBubble from '../components/MessageBubble';
import { streamAskAI } from '../services/api';
import { useSpeechToText } from '../hooks/useSpeechToText';

const ChatScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isRecording, startRecording, stopRecordingAndTranscribe } = useSpeechToText();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Welcome message
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'ai',
      content: 'Merhaba, ben CMK Asistanı. Size nasıl yardımcı olabilirim?',
    };
    setMessages([welcomeMessage]);
    Speech.speak(welcomeMessage.content, { language: 'tr-TR' });
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: text };
    const aiMessagePlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      content: '', // Start with empty content
      sources: [],
    };
    setMessages(prev => [...prev, userMessage, aiMessagePlaceholder]);
    setInput('');
    setIsLoading(true);

    let fullResponse = '';

    streamAskAI(
      text,
      (sources) => {
        // Update the AI message placeholder with the sources
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessagePlaceholder.id ? { ...msg, sources } : msg
        ));
      },
      (chunk) => {
        // Append the new chunk to the AI message content
        fullResponse += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessagePlaceholder.id ? { ...msg, content: fullResponse } : msg
        ));
      },
      () => {
        // Streaming complete
        setIsLoading(false);
        Speech.speak(fullResponse, { language: 'tr-TR' });
      },
      (error) => {
        console.error(error);
        const errorMessage: Message = { id: Date.now().toString(), role: 'ai', content: 'Üzgünüm, bir hata oluştu.' };
        setMessages(prev => [...prev.slice(0, -1), errorMessage]); // Replace placeholder with error
        setIsLoading(false);
      }
    );
  };

  const handleVoiceButtonPress = async () => {
    if (isLoading) return;
    if (isRecording) {
      const transcribedText = await stopRecordingAndTranscribe();
      if (transcribedText) {
        setInput(transcribedText);
        handleSend(transcribedText);
      }
    } else {
      await startRecording();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="CMK Asistanı" />
      </Appbar.Header>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
        keyExtractor={(item) => item.id || Math.random().toString()}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isLoading && !isRecording && <ActivityIndicator animating={true} style={styles.loader} />}
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Mesajınızı yazın..."
            onSubmitEditing={() => handleSend(input)}
            disabled={isLoading}
            mode="outlined"
            outlineStyle={{ borderRadius: 30 }}
          />
          <Button
            icon={isRecording ? "stop-circle-outline" : "microphone"}
            onPress={handleVoiceButtonPress}
            disabled={isLoading && !isRecording}
            mode="contained"
            style={[styles.button, isRecording && styles.recordingButton]}
            labelStyle={styles.buttonLabel}
          />
          <Button 
            icon="send" 
            onPress={() => handleSend(input)} 
            disabled={!input.trim() || isLoading}
            mode="contained"
            style={styles.button}
            labelStyle={styles.buttonLabel}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  messageList: {
    padding: 10,
  },
  loader: {
    padding: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'white',
  },
  textInput: {
    flex: 1,
    marginRight: 8,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: 4,
  },
  recordingButton: {
    backgroundColor: 'red'
  },
  buttonLabel: {
    fontSize: 20,
    lineHeight: 22,
  }
});

export default ChatScreen; 