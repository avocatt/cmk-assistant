export interface Source {
  source_document: string;
  page: number;
  content: string;
}

export interface Message {
  role: 'user' | 'ai';
  content: string;
  sources?: Source[];
} 