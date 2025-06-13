import axios from 'axios';
import { Message, Source } from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("Missing environment variable: EXPO_PUBLIC_API_URL");
}

const apiClient = axios.create({
  baseURL: API_URL,
});

// This function now takes callbacks to handle the streaming data
export const askAI = async (question: string): Promise<{answer: string, sources: Source[]}> => {
  try {
    const response = await apiClient.post('/chat', {
      question: question
    });
    
    return {
      answer: response.data.answer,
      sources: response.data.sources || []
    };
  } catch (error: any) {
    console.error('Error asking AI:', error.response?.data || error.message);
    throw new Error('Failed to get AI response');
  }
};

export const transcribeAudio = async (uri: string): Promise<string> => {
  const formData = new FormData();
  
  // The 'as any' is needed because React Native's FormData typing can be tricky.
  // This correctly sends the file for transcription.
  formData.append('file', {
    uri,
    name: 'audio.m4a', // or .mp4 for android
    type: 'audio/m4a',
  } as any);

  try {
    // This now calls our own secure backend endpoint
    const response = await apiClient.post('/api/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.text;
  } catch (error: any) {
    console.error('Error transcribing audio:', error.response?.data || error.message);
    throw new Error('Failed to transcribe audio');
  }
}; 