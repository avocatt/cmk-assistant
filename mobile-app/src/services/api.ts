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
export const streamAskAI = async (
    question: string,
    onSources: (sources: Source[]) => void,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
) => {
  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sourcesReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      
      const chunk = decoder.decode(value);
      // SSE format can send multiple events in one chunk, split by \n\n
      const events = chunk.split('\n\n').filter(e => e.length > 0);

      for (const event of events) {
        if (event.startsWith('data:')) {
          const dataStr = event.substring(5);
          const data = JSON.parse(dataStr);

          if (data.sources && !sourcesReceived) {
            onSources(data.sources);
            sourcesReceived = true;
          } else if (data.answer_chunk) {
            onChunk(data.answer_chunk);
          }
        }
      }
    }
    onComplete();
  } catch (error: any) {
    console.error('Error in streaming AI response:', error);
    onError(error);
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