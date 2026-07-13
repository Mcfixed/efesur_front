import { apiClient } from "@/apis";
import type { GpsDevice, ChirpstackCommand, SendResult } from "../types/chirpstack.types";

export const chirpstackService = {
  chirpstackAuth: async (password: string) => {
    const response = await apiClient.post<{data: { token: string; expiresAt: number }}>("/chirpstack/auth", { password });
    return response.data.data;
  },
  getCommands: async () => {
    const response = await apiClient.get<{data: ChirpstackCommand[]}>("/chirpstack/commands");
    return response.data.data;
  },
  getGpsDevices: async () => {
    const response = await apiClient.get<{data: GpsDevice[]}>("/chirpstack/devices");
    return response.data.data;
  },
  sendCommand: async (devEuis: string[], command: string) => {
    const response = await apiClient.post<{data: SendResult}>("/chirpstack/send-command", { devEuis, command });
    return response.data.data;
  },
};
