export interface Source {
  source_document: string;
  page: number;
  content: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'ai';
  content: string;
  sources?: Source[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: import('react-native-gifted-chat').IMessage[];
}

export interface ChatSessionPreview {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: Date;
  messageCount: number;
} 