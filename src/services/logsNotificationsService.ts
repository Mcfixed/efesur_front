import { apiClient } from '../apis/apiClient';

export interface Notification {
    id: number;
    user_id: number;
    company_id?: number;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    action_url?: string;
    read_at?: string;
    metadata?: any;
    created_at: string;
}

export interface NotificationPreferences {
    id: number;
    user_id: number;
    notify_on_login: boolean;
    notify_on_logout: boolean;
    notify_on_company_changes: boolean;
    notify_on_user_changes: boolean;
    notify_on_service_changes: boolean;
    notify_on_errors: boolean;
    email_notifications: boolean;
    push_notifications: boolean;
}

export interface Log {
    id: number;
    user_id?: number;
    company_id?: number;
    action: string;
    method: string;
    endpoint: string;
    status_code: number;
    execution_time_ms: number;
    error_message?: string;
    created_at: string;
}

export class NotificationsService {
    static async getNotifications(limit = 50, offset = 0, unreadOnly = false) {
        try {
            const response = await apiClient.get('/logs-notifications/notifications', {
                params: {
                    limit,
                    offset,
                    unread_only: unreadOnly,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }
    }

    static async getUnreadCount() {
        try {
            const response = await apiClient.get('/logs-notifications/notifications/unread/count');
            return response.data;
        } catch (error) {
            console.error('Error fetching unread count:', error);
            throw error;
        }
    }

    static async markAsRead(notificationId: number) {
        try {
            const response = await apiClient.put(
                `/logs-notifications/notifications/${notificationId}/read`
            );
            return response.data;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    static async markAllAsRead() {
        try {
            const response = await apiClient.put(
                '/logs-notifications/notifications/read-all'
            );
            return response.data;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    static async deleteNotification(notificationId: number) {
        try {
            const response = await apiClient.delete(
                `/logs-notifications/notifications/${notificationId}`
            );
            return response.data;
        } catch (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    }

    static async getPreferences() {
        try {
            const response = await apiClient.get(
                '/logs-notifications/notification-preferences'
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching preferences:', error);
            throw error;
        }
    }

    static async updatePreferences(preferences: Partial<NotificationPreferences>) {
        try {
            const response = await apiClient.put(
                '/logs-notifications/notification-preferences',
                preferences
            );
            return response.data;
        } catch (error) {
            console.error('Error updating preferences:', error);
            throw error;
        }
    }

    static async createNotification(notification: {
        user_id: number;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
        action_url?: string;
        metadata?: any;
    }) {
        try {
            const response = await apiClient.post(
                '/logs-notifications/notifications/create',
                notification
            );
            return response.data;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }
}

export class LogsService {
    static async getUserLogs(limit = 50, offset = 0, action?: string, statusCode?: number) {
        try {
            const response = await apiClient.get('/logs-notifications/user-logs', {
                params: {
                    limit,
                    offset,
                    action,
                    status_code: statusCode,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching user logs:', error);
            throw error;
        }
    }

    static async getLogDetail(logId: number) {
        try {
            const response = await apiClient.get(`/logs-notifications/logs/${logId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching log detail:', error);
            throw error;
        }
    }

    static async getLogStats(days = 7) {
        try {
            const response = await apiClient.get('/logs-notifications/logs/stats', {
                params: { days },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching log stats:', error);
            throw error;
        }
    }

    static async getCompanyLogs(
        companyId: number,
        limit = 100,
        offset = 0,
        userId?: number,
        method?: string,
        statusCode?: number
    ) {
        try {
            const response = await apiClient.get(
                `/logs-notifications/company/${companyId}/logs`,
                {
                    params: {
                        limit,
                        offset,
                        userId,
                        method,
                        status_code: statusCode,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching company logs:', error);
            throw error;
        }
    }
}
