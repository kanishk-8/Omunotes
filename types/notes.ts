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

export interface NotebookContentItem {
  type: "text" | "image" | "heading" | "subheading" | "points" | "code";
  content: string;
  order: number;
  imageData?: string;
  mimeType?: string;
  language?: string; // For code blocks
  points?: string[]; // For point lists
}
