import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, FlatList, TouchableOpacity, Text, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { Message } from '../types';
import MessageBubble from '../components/MessageBubble';
import { askAI } from '../services/api';
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
      role: 'ai',
      content: 'Merhaba, ben CMK Asistanı. Size nasıl yardımcı olabilirim?',
    };
    setMessages([welcomeMessage]);
    Speech.speak(welcomeMessage.content, { language: 'tr-TR' });
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiResponse = await askAI(text);
      setMessages(prev => [...prev, aiResponse]);
      Speech.speak(aiResponse.content, { language: 'tr-TR' });
    } catch (error) {
      console.error(error);
      const errorMessage: Message = { role: 'ai', content: 'Üzgünüm, bir hata oluştu.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceButtonPress = async () => {
    if (isRecording) {
      setIsLoading(true);
      const transcribedText = await stopRecordingAndTranscribe();
      setIsLoading(false);
      if (transcribedText) {
        setInput(transcribedText); // Set text to input for review
        handleSend(transcribedText); // Or send immediately
      }
    } else {
      await startRecording();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
       {isLoading && <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Mesajınızı yazın..."
            onSubmitEditing={() => handleSend(input)}
          />
          <TouchableOpacity style={[styles.voiceButton, isRecording && styles.recordingButton]} onPress={handleVoiceButtonPress}>
            <Text style={styles.voiceButtonText}>{isRecording ? '■' : '🎤'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendButton} onPress={() => handleSend(input)}>
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
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
    paddingVertical: 10,
  },
  loader: {
    marginVertical: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  textInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 20,
    paddingHorizontal: 15,
    backgroundColor: '#FFF',
  },
  voiceButton: {
    marginLeft: 10,
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#007AFF',
  },
  recordingButton: {
    backgroundColor: 'red',
  },
  voiceButtonText: {
    color: 'white',
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
    padding: 10,
  },
  sendButtonText: {
    fontSize: 20,
    color: '#007AFF',
  }
});

export default ChatScreen; 