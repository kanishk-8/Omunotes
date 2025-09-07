export interface SavedNote {
  id: string;
  prompt: string;
  content: string;
  createdAt: string;
}

export interface ApiKey {
  value: string;
  createdAt: string;
}
