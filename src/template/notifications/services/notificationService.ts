import { apiClient } from '@/apis';
import type {
  Notification,
  CreateNotificationDTO,
  NotificationPaginatedResponse,
  NotificationFilters,
  NotificationPreferences,
} from '../types';

// Endpoints según tu backend
const NOTIFICATIONS_ENDPOINT = '/notifications';
const PREFERENCES_ENDPOINT = '/notification-preferences';

export const notificationService = {
  /**
   * Obtener notificaciones del usuario
   * GET /notifications
   */
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

  /**
   * Crear una nueva notificación (admin/sistema)
   * POST /notifications/create
   */
  async createNotification(data: CreateNotificationDTO): Promise<Notification> {
    const response = await apiClient.post<Notification>(
      `${NOTIFICATIONS_ENDPOINT}/create`,
      data
    );
    return response.data;
  },

  /**
   * Marcar notificación como leída
   * PUT /notifications/:notificationId/read
   */
  async markAsRead(id: string): Promise<Notification> {
    const response = await apiClient.put<Notification>(
      `${NOTIFICATIONS_ENDPOINT}/${id}/read`
    );
    return response.data;
  },

  /**
   * Marcar todas las notificaciones como leídas
   * PUT /notifications/read-all
   */
  async markAllAsRead(): Promise<void> {
    await apiClient.put(`${NOTIFICATIONS_ENDPOINT}/read-all`);
  },

  /**
   * Eliminar notificación
   * DELETE /notifications/:notificationId
   */
  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`${NOTIFICATIONS_ENDPOINT}/${id}`);
  },

  /**
   * Obtener contador de no leídas
   * GET /notifications/unread/count
   */
  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get<{ count: number }>(
      `${NOTIFICATIONS_ENDPOINT}/unread/count`
    );
    return response.data.count;
  },

  // ========== Preferencias ==========

  /**
   * Obtener preferencias de notificaciones del usuario
   * GET /notification-preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    const response = await apiClient.get<NotificationPreferences>(
      PREFERENCES_ENDPOINT
    );
    return response.data;
  },

  /**
   * Actualizar preferencias de notificaciones
   * PUT /notification-preferences
   */
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

  /**
   * Suscribirse a notificaciones en tiempo real
   * Retorna función para desuscribirse
   */
  subscribeToNotifications(
    _onNotification: (notification: Notification) => void
  ): () => void {
    // Aquí iría la lógica de WebSocket/SSE
    console.log('Subscribed to notifications');
    
    // Placeholder - implementar con WebSocket real
    const unsubscribe = () => {
      console.log('Unsubscribed from notifications');
    };
    
    return unsubscribe;
  },
};
