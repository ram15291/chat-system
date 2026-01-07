import axios from 'axios';
import { AuthResponse, Conversation, Message, Member } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost';

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_URL}/api/users/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/users/auth/login', {
      username,
      password,
    });
    return response.data;
  },

  register: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/users/auth/register', {
      username,
      email,
      password,
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/api/users/me');
    return response.data;
  },

  searchUsers: async (query: string, limit: number = 20) => {
    const response = await api.get('/api/users/search', {
      params: { q: query, limit },
    });
    return response.data;
  },

  logout: async () => {
    await api.post('/api/users/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

export const chatService = {
  getConversations: async (): Promise<Conversation[]> => {
    const response = await api.get<Conversation[]>('/api/chats/conversations');
    return response.data;
  },

  createDM: async (recipientId: string): Promise<Conversation> => {
    const response = await api.post<Conversation>('/api/chats/conversations/dm', {
      other_user_id: recipientId,
    });
    return response.data;
  },

  createGroup: async (name: string, memberIds: string[]): Promise<Conversation> => {
    const response = await api.post<Conversation>('/api/chats/conversations/group', {
      title: name,
      member_ids: memberIds,
    });
    return response.data;
  },

  getMembers: async (conversationId: string): Promise<Member[]> => {
    const response = await api.get<Member[]>(
      `/api/chats/conversations/${conversationId}/members`
    );
    return response.data;
  },

  inviteUser: async (conversationId: string, userId: string): Promise<void> => {
    await api.post(`/api/chats/conversations/${conversationId}/invite`, {
      user_id: userId,
    });
  },
};

export const messageService = {
  getMessages: async (
    conversationId: string,
    beforeSeq?: number,
    limit: number = 50
  ): Promise<Message[]> => {
    const params: any = { limit };
    if (beforeSeq) {
      params.before_seq = beforeSeq;
    }

    const response = await api.get<Message[]>(
      `/api/messages/conversations/${conversationId}/messages`,
      { params }
    );
    return response.data;
  },

  getMessageFull: async (conversationId: string, messageId: string): Promise<Message> => {
    const response = await api.get<Message>(
      `/api/messages/conversations/${conversationId}/messages/${messageId}`,
      { params: { fields: 'full' } }
    );
    return response.data;
  },

  sendMessage: async (conversationId: string, body: string): Promise<Message> => {
    const response = await api.post<Message>(
      `/api/messages/conversations/${conversationId}/messages`,
      { body }
    );
    return response.data;
  },

  markAsRead: async (conversationId: string, seq: number): Promise<void> => {
    await api.post(`/api/messages/conversations/${conversationId}/read`, {
      seq,
    });
  },
};

export default api;
