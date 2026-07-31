import type { MapRef } from "react-map-gl";

export type MapLayer = "street" | "dark" | "satellite" | "smooth";

export interface MapLayerConfig {
  name: string;
  icon: React.ReactNode;
  style: string;
}

export interface MapCenter {
  longitude: number;
  latitude: number;
}

export interface BaseMapProps {
  children?: React.ReactNode;
  initialCenter?: MapCenter;
  initialZoom?: number;
  initialPitch?: number;
  initialBearing?: number;
  onMapRef?: (ref: MapRef | null) => void;
}

export interface CustomZoomControlProps {
  mapRef: React.RefObject<MapRef | null>;
}

export interface ViewControlsProps {
  mapRef: React.RefObject<MapRef | null>;
  initialCenter: MapCenter;
  initialZoom: number;
}

export interface LayerSelectorProps {
  selectedLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  mapLayers: Record<MapLayer, MapLayerConfig>;
}
