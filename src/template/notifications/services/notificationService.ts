import { apiClient } from '@/apis';
import type {
  Notification,
  CreateNotificationDTO,
  NotificationPaginatedResponse,
  NotificationFilters,
  NotificationPreferences,
} from '../types';

const NOTIFICATIONS_ENDPOINT = '/notifications';
const PREFERENCES_ENDPOINT = '/notification-preferences';

export const notificationService = {
  async getNotifications(
    filters?: NotificationFilters,
    page = 1,
    limit = 20
  ): Promise<NotificationPaginatedResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters?.status?.length) {
      params.append('status', filters.status.join(','));
    }
    if (filters?.type?.length) {
      params.append('type', filters.type.join(','));
    }
    if (filters?.priority?.length) {
      params.append('priority', filters.priority.join(','));
    }
    if (filters?.category?.length) {
      params.append('category', filters.category.join(','));
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }

    const response = await apiClient.get<NotificationPaginatedResponse>(
      `${NOTIFICATIONS_ENDPOINT}?${params.toString()}`
    );
    return response.data;
  },

  async createNotification(data: CreateNotificationDTO): Promise<Notification> {
    const response = await apiClient.post<Notification>(
      `${NOTIFICATIONS_ENDPOINT}/create`,
      data
    );
    return response.data;
  },

  async markAsRead(id: string): Promise<Notification> {
    const response = await apiClient.put<Notification>(
      `${NOTIFICATIONS_ENDPOINT}/${id}/read`
    );
    return response.data;
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.put(`${NOTIFICATIONS_ENDPOINT}/read-all`);
  },

  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`${NOTIFICATIONS_ENDPOINT}/${id}`);
  },

  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get<{ count: number }>(
      `${NOTIFICATIONS_ENDPOINT}/unread/count`
    );
    return response.data.count;
  },

  // ========== Preferencias ==========

  async getPreferences(): Promise<NotificationPreferences> {
    const response = await apiClient.get<NotificationPreferences>(
      PREFERENCES_ENDPOINT
    );
    return response.data;
  },

  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const response = await apiClient.put<NotificationPreferences>(
      PREFERENCES_ENDPOINT,
      preferences
    );
    return response.data;
  },

  // ========== WebSocket / Real-time ==========

  subscribeToNotifications(
    _onNotification: (notification: Notification) => void
  ): () => void {
    // Placeholder: falta el WebSocket real.
    console.log('Subscribed to notifications');
    
    const unsubscribe = () => {
      console.log('Unsubscribed from notifications');
    };
    
    return unsubscribe;
  },
};
