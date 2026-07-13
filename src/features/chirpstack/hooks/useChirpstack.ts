import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chirpstackService } from "../services/chirpstack.service";

const KEYS = {
  all: ["chirpstack"] as const,
  commands: () => [...KEYS.all, "commands"] as const,
  devices: () => [...KEYS.all, "devices"] as const,
};

export const useChirpstackCommands = () => {
  return useQuery({
    queryKey: KEYS.commands(),
    queryFn: () => chirpstackService.getCommands(),
    staleTime: Infinity,
  });
};

export const useGpsDevices = () => {
  return useQuery({
    queryKey: KEYS.devices(),
    queryFn: () => chirpstackService.getGpsDevices(),
    refetchInterval: 30000,
  });
};

export const useSendCommand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ devEuis, command }: { devEuis: string[]; command: string }) =>
      chirpstackService.sendCommand(devEuis, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.devices() });
    },
  });
};
