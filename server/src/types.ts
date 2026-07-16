export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  avatarColor: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  personaId: string;
  title: string;
  createdAt: number;
}

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface Memory {
  id: string;
  personaId: string;
  content: string;
  embedding: number[];
  createdAt: number;
}

export interface StoreShape {
  personas: Persona[];
  conversations: Conversation[];
  messages: Message[];
  memories: Memory[];
}
