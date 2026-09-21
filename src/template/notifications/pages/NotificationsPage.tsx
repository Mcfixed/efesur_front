import { useState } from "react";
import {
  IconBell,
  IconCheck,
  IconTrash,
  IconSearch,
  IconSettings,
  IconInbox,
  IconChecks,
} from "@tabler/icons-react";
import { NavLink } from "react-router";
import { useNotificationStore } from "../stores";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Notification, NotificationType } from "../types";

const typeStyles: Record<NotificationType, { bg: string; text: string }> = {
  info: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600" },
  success: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600" },
  warning: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-600" },
  error: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600" },
  system: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600" },
};

const typeLabels: Record<NotificationType, string> = {
  info: "Información",
  success: "Éxito",
  warning: "Advertencia",
  error: "Error",
  system: "Sistema",
};

function formatTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

type TabType = "all" | "unread";

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<NotificationType | "all">("all");
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  const {
    notifications,
    getStats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  const stats = getStats();

  // Filtrar por tab
  const getNotificationsByTab = () => {
    let filtered = notifications.filter((n) => n.status !== "deleted");

    if (activeTab === "unread") {
      filtered = filtered.filter((n) => n.status === "unread");
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((n) => n.type === selectedType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredNotifications = getNotificationsByTab();

  // Selección múltiple
  const toggleSelect = (id: string) => {
    setSelectedNotifications((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map((n) => n.id));
    }
  };

  const bulkMarkAsRead = () => {
    selectedNotifications.forEach((id) => markAsRead(id));
    setSelectedNotifications([]);
  };

  const bulkDelete = () => {
    selectedNotifications.forEach((id) => deleteNotification(id));
    setSelectedNotifications([]);
  };

  return (
    <div className="w-full h-full p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Notificaciones</h1>
            <p className="text-text-200 text-sm mt-1">
              {stats.unread} sin leer de {stats.total} totales
            </p>
          </div>
          <NavLink
            to="/template/notificaciones/preferencias"
            className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg-200 transition-colors"
          >
            <IconSettings size={18} />
            Preferencias
          </NavLink>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {(Object.keys(typeLabels) as NotificationType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(selectedType === type ? "all" : type)}
              className={`p-4 rounded-lg border transition-colors ${
                selectedType === type
                  ? "border-secondary bg-200/10"
                  : "border-border hover:bg-bg-200"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg ${typeStyles[type].bg} ${typeStyles[type].text} flex items-center justify-center mb-2`}
              >
                <IconBell size={18} />
              </div>
              <p className="text-xs text-text-200">{typeLabels[type]}</p>
              <p className="text-lg font-semibold">{stats.byType[type] || 0}</p>
            </button>
          ))}
        </div>

        {/* Tabs y Búsqueda */}
        <div className="flex items-center justify-between mb-4 gap-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-bg-200 rounded-lg">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                activeTab === "all"
                  ? "bg-bg-100 shadow"
                  : "hover:bg-bg-100/50"
              }`}
            >
              <IconInbox size={16} className="inline mr-2" />
              Todas
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                activeTab === "unread"
                  ? "bg-bg-100 shadow"
                  : "hover:bg-bg-100/50"
              }`}
            >
              <IconBell size={16} className="inline mr-2" />
              Sin leer ({stats.unread})
            </button>
          </div>

          {/* Búsqueda */}
          <div className="relative flex-1 max-w-xs">
            <IconSearch
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-200"
            />
            <input
              type="text"
              placeholder="Buscar notificaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-bg-100 focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
        </div>

        {/* Acciones en lote */}
        {selectedNotifications.length > 0 && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-200/10 border border-secondary/30 rounded-lg">
            <span className="text-sm">
              {selectedNotifications.length} seleccionadas
            </span>
            <button
              onClick={bulkMarkAsRead}
              className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-200/20 rounded transition-colors"
            >
              <IconCheck size={16} /> Marcar como leídas
            </button>
            <button
              onClick={bulkDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <IconTrash size={16} /> Eliminar
            </button>
          </div>
        )}

        {/* Lista de notificaciones */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header de lista */}
          <div className="flex items-center gap-4 px-4 py-3 bg-bg-200 border-b border-border">
            <input
              type="checkbox"
              checked={
                selectedNotifications.length === filteredNotifications.length &&
                filteredNotifications.length > 0
              }
              onChange={selectAll}
              className="rounded"
            />
            <span className="text-sm text-text-200 flex-1">
              {filteredNotifications.length} notificaciones
            </span>
            {stats.unread > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-200 hover:underline"
              >
                <IconChecks size={14} className="inline mr-1" />
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="divide-y divide-border">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  isSelected={selectedNotifications.includes(notification.id)}
                  onSelect={() => toggleSelect(notification.id)}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))
            ) : (
              <div className="py-12 text-center">
                <IconInbox
                  size={48}
                  className="mx-auto text-text-200 mb-3"
                  stroke={1}
                />
                <p className="text-text-200">
                  No hay notificaciones
                  {activeTab === "unread" && " sin leer"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface NotificationRowProps {
  notification: Notification;
  isSelected: boolean;
  onSelect: () => void;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

function NotificationRow({
  notification,
  isSelected,
  onSelect,
  onMarkAsRead,
  onDelete,
}: NotificationRowProps) {
  const isUnread = notification.status === "unread";
  const styles = typeStyles[notification.type];

  return (
    <div
      className={`flex items-start gap-4 px-4 py-4 hover:bg-bg-200 transition-colors group ${
        isUnread ? "bg-200/5" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onSelect}
        className="mt-1 rounded"
      />

      <div className={`w-10 h-10 rounded-lg ${styles.bg} ${styles.text} flex items-center justify-center shrink-0`}>
        <IconBell size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm ${isUnread ? "font-semibold" : ""}`}>
                {notification.title}
              </p>
              {isUnread && (
                <span className="w-2 h-2 bg-200 rounded-full" />
              )}
            </div>
            <p className="text-sm text-text-200 mt-1 line-clamp-2">
              {notification.message}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-text-200">
                {formatTime(notification.createdAt)}
              </span>
              {notification.category && (
                <span className="text-xs px-2 py-0.5 bg-bg-200 rounded">
                  {notification.category}
                </span>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isUnread && (
              <button
                onClick={onMarkAsRead}
                className="p-2 hover:bg-bg-100 rounded-lg"
                title="Marcar como leída"
              >
                <IconCheck size={18} />
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-500"
              title="Eliminar"
            >
              <IconTrash size={18} />
            </button>
          </div>
        </div>

        {/* Botón de acción si existe */}
        {notification.actionUrl && (
          <NavLink
            to={notification.actionUrl}
            className="inline-block mt-3 px-4 py-1.5 text-sm bg-200 text-white rounded-lg hover:bg-200/90 transition-colors"
          >
            {notification.actionLabel || "Ver más"}
          </NavLink>
        )}
      </div>
    </div>
  );
}
