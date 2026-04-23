export type Role = 'user' | 'bot';

export type TextMessage = {
  id: string;
  role: Role;
  kind: 'text';
  text: string;
  createdAt: number;
};

export type ImageMessage = {
  id: string;
  role: Role;
  kind: 'image';
  uri: string;
  createdAt: number;
};

export type Message = TextMessage | ImageMessage;
