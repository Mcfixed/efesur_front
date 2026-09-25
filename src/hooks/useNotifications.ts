import { useState, useCallback, useEffect, useRef } from "react";
import {
  NotificationsService,
  LogsService,
  type Notification,
  type Log,
  type NotificationPreferences,
} from "../services/logsNotificationsService";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
  });

  const fetchNotifications = useCallback(
    async (limit = 50, offset = 0, unreadOnly = false) => {
      setLoading(true);
      setError(null);
      try {
        const result = (await NotificationsService.getNotifications(
          limit,
          offset,
          unreadOnly,
        )) as { data: Notification[]; pagination: typeof pagination };
        setNotifications(result.data);
        setPagination(result.pagination);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Error al obtener notificaciones";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = (await NotificationsService.getUnreadCount()) as {
        unread: number;
      };
      setUnreadCount(result.unread);
    } catch (err) {
      console.error("Error al obtener conteo de no leídas:", err);
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationId: number) => {
      try {
        await NotificationsService.markAsRead(notificationId);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ),
        );
        fetchUnreadCount();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error al marcar como leída";
        setError(errorMessage);
      }
    },
    [fetchUnreadCount],
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await NotificationsService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Error al marcar todas como leídas";
      setError(errorMessage);
    }
  }, []);

  const deleteNotification = useCallback(
    async (notificationId: number) => {
      try {
        await NotificationsService.deleteNotification(notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        fetchUnreadCount();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error al eliminar notificación";
        setError(errorMessage);
      }
    },
    [fetchUnreadCount],
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    pagination,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

export function useNotificationPreferences() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await NotificationsService.getPreferences()) as {
        data: NotificationPreferences;
      };
      setPreferences(result.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al obtener preferencias";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (newPreferences: Partial<NotificationPreferences>) => {
      setLoading(true);
      setError(null);
      try {
        const result = (await NotificationsService.updatePreferences(
          newPreferences,
        )) as { data: NotificationPreferences };
        setPreferences(result.data);
        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Error al actualizar preferencias";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    preferences,
    loading,
    error,
    fetchPreferences,
    updatePreferences,
  };
}

export function useLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
  });

  const fetchUserLogs = useCallback(
    async (limit = 50, offset = 0, action?: string, statusCode?: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = (await LogsService.getUserLogs(
          limit,
          offset,
          action,
          statusCode,
        )) as { data: Log[]; pagination: typeof pagination };
        setLogs(result.data);
        setPagination(result.pagination);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error al obtener logs";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getLogDetail = useCallback(async (logId: number) => {
    try {
      const result = (await LogsService.getLogDetail(logId)) as { data: Log };
      return result.data;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Error al obtener detalles del log";
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    logs,
    loading,
    error,
    pagination,
    fetchUserLogs,
    getLogDetail,
  };
}

export function useLogStats() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (days = 7) => {
    setLoading(true);
    setError(null);
    try {
      const result = (await LogsService.getLogStats(days)) as {
        data: Record<string, unknown>;
      };
      setStats(result.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al obtener estadísticas";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
}

export function useNotificationPolling(interval = 30000) {
  const { fetchUnreadCount } = useNotifications();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    intervalRef.current = setInterval(() => {
      fetchUnreadCount();
    }, interval);
  }, [fetchUnreadCount, interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return { startPolling, stopPolling };
}

export function useNotificationsToast(toast: {
  success: (
    title: string,
    options?: {
      description?: string;
      action?: { label: string; onClick: () => void };
    },
  ) => void;
  error: (
    title: string,
    options?: {
      description?: string;
      action?: { label: string; onClick: () => void };
    },
  ) => void;
  warning: (
    title: string,
    options?: {
      description?: string;
      action?: { label: string; onClick: () => void };
    },
  ) => void;
  info: (
    title: string,
    options?: {
      description?: string;
      action?: { label: string; onClick: () => void };
    },
  ) => void;
}) {
  const { notifications, fetchNotifications, unreadCount } = useNotifications();

  const showNotificationAsToast = useCallback(
    (notification: Notification) => {
      const toastType = notification.type as
        | "success"
        | "error"
        | "warning"
        | "info";

      toast[toastType](notification.title, {
        description: notification.message,
        action: notification.action_url
          ? {
              label: "Ver",
              onClick: () => {
                if (notification.action_url) {
                  window.location.href = notification.action_url;
                }
              },
            }
          : undefined,
      });
    },
    [toast],
  );

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    showNotificationAsToast,
  };
}

export function useLogMonitoring(autoFetch = true, fetchInterval = 60000) {
  const { logs, fetchUserLogs, loading, error } = useLogs();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoFetch) {
      // Fetch inicial
      fetchUserLogs();

      // Setup polling
      intervalRef.current = setInterval(() => {
        fetchUserLogs();
      }, fetchInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoFetch, fetchInterval, fetchUserLogs]);

  return {
    logs,
    loading,
    error,
    refetch: fetchUserLogs,
  };
}
