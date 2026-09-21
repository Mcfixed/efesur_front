import React, { useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import type { Notification } from '../../services/logsNotificationsService';

interface NotificationPanelProps {
    maxHeight?: string;
    showUnreadBadge?: boolean;
}

/**
 * Componente para mostrar el panel de notificaciones
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({
    maxHeight = '400px',
    showUnreadBadge = true,
}) => {
    const {
        notifications,
        unreadCount,
        loading,
        error,
        pagination,
        fetchNotifications,
        markAsRead,
        deleteNotification,
        markAllAsRead,
    } = useNotifications();

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleMarkAsRead = async (notificationId: number) => {
        await markAsRead(notificationId);
    };

    const handleDelete = async (notificationId: number) => {
        await deleteNotification(notificationId);
    };

    const handleMarkAll = async () => {
        await markAllAsRead();
    };

    const handleLoadMore = async () => {
        await fetchNotifications(pagination.limit, pagination.offset + pagination.limit);
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '⚠';
            case 'info':
            default:
                return 'ℹ';
        }
    };

    return (
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg border border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Notificaciones</h3>
                    {showUnreadBadge && unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAll}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                        Marcar todas como leídas
                    </button>
                )}
            </div>

            {/* Content */}
            <div
                style={{ maxHeight, overflowY: 'auto' }}
                className="divide-y divide-gray-200"
            >
                {loading && !notifications.length && (
                    <div className="p-4 text-center text-gray-500">
                        Cargando notificaciones...
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border-l-4 border-red-400">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {!loading && notifications.length === 0 && !error && (
                    <div className="p-4 text-center text-gray-500">
                        No hay notificaciones
                    </div>
                )}

                {notifications.map((notification: Notification) => (
                    <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                            notification.read_at ? 'opacity-75' : 'font-semibold'
                        }`}
                        onClick={() => {
                            if (!notification.read_at) {
                                handleMarkAsRead(notification.id);
                            }
                        }}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                                <span
                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white flex-shrink-0 ${
                                        notification.type === 'success'
                                            ? 'bg-green-500'
                                            : notification.type === 'error'
                                            ? 'bg-red-500'
                                            : notification.type === 'warning'
                                            ? 'bg-yellow-500'
                                            : 'bg-blue-500'
                                    }`}
                                >
                                    {getNotificationIcon(notification.type)}
                                </span>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900">
                                        {notification.title}
                                    </h4>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        {new Date(notification.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(notification.id);
                                }}
                                className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                                title="Eliminar notificación"
                            >
                                ✕
                            </button>
                        </div>
                        {notification.action_url && (
                            <a
                                href={notification.action_url}
                                className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-block"
                            >
                                Ver más →
                            </a>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer - Load more */}
            {pagination.total > notifications.length && (
                <button
                    onClick={handleLoadMore}
                    className="w-full p-3 text-center text-sm text-blue-600 hover:bg-blue-50 font-medium border-t border-gray-200"
                    disabled={loading}
                >
                    {loading ? 'Cargando...' : 'Cargar más'}
                </button>
            )}
        </div>
    );
};

/**
 * Componente mini badge para mostrar notificaciones no leídas
 */
export const NotificationBadge: React.FC = () => {
    const { unreadCount, fetchUnreadCount } = useNotifications();

    useEffect(() => {
        // Fetch inicial
        fetchUnreadCount();

        // Polling cada 30 segundos
        const interval = setInterval(() => {
            fetchUnreadCount();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    if (unreadCount === 0) return null;

    return (
        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
        </span>
    );
};

/**
 * Componente para mostrar un sola notificación
 */
interface SingleNotificationProps {
    notification: Notification;
    onMarkAsRead?: (id: number) => void;
    onDelete?: (id: number) => void;
}

export const SingleNotificationItem: React.FC<SingleNotificationProps> = ({
    notification,
    onMarkAsRead,
    onDelete,
}) => {
    return (
        <div
            className={`p-3 rounded-lg border-l-4 ${
                notification.type === 'success'
                    ? 'bg-green-50 border-green-500'
                    : notification.type === 'error'
                    ? 'bg-red-50 border-red-500'
                    : notification.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-blue-50 border-blue-500'
            }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <h5 className="font-semibold text-gray-900">{notification.title}</h5>
                    <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                        {new Date(notification.created_at).toLocaleString()}
                    </p>
                </div>
                {onDelete && (
                    <button
                        onClick={() => onDelete(notification.id)}
                        className="text-gray-400 hover:text-red-500 ml-2"
                    >
                        ✕
                    </button>
                )}
            </div>
            {!notification.read_at && onMarkAsRead && (
                <button
                    onClick={() => onMarkAsRead(notification.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium"
                >
                    Marcar como leído
                </button>
            )}
        </div>
    );
};
