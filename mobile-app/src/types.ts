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