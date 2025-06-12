import { useState } from 'react';
import { Audio } from 'expo-av';
import { transcribeAudio } from '../services/api';

export const useSpeechToText = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission not granted');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setError(null);
    } catch (err: any) {
      setError('Failed to start recording: ' + err.message);
    }
  };

  const stopRecordingAndTranscribe = async (): Promise<string | null> => {
    if (!recording) return null;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      try {
        const transcribedText = await transcribeAudio(uri);
        return transcribedText;
      } catch (err: any) {
        setError('Failed to transcribe audio: ' + err.message);
        return null;
      }
    }
    return null;
  };

  return { isRecording, error, startRecording, stopRecordingAndTranscribe };
}; 