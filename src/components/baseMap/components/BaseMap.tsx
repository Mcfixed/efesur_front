import React, { useRef, useCallback, useMemo, useState } from "react";
import ReactMapGL from "react-map-gl";
import type { MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  IconMap,
  IconSatellite,
  IconWorld,
  IconMapPin,
  IconSun,
  IconMountain,
  IconNavigation,
  IconMoon,
  IconTrees,
  IconLayout,
  IconStack,
  IconCar,
  IconBolt,
  IconSquare,
  IconRoad,
  IconBrightnessUp,
  IconMoonStars,
  IconLeaf,
  IconPencil,
  IconTerminal2,
  IconNumber,
  IconRipple,
  IconCompass,
  IconIceCream,
  IconCloudMinus,
  IconRocket,
  IconCircleDot,
  IconSteeringWheel,
  IconFocus2,
} from "@tabler/icons-react";

import CustomZoomControl from "./CustomZoomControl";
import ViewControls from "./ViewControls";
import LayerSelector from "./LayerSelector";
import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_ZOOM_LEVEL } from "../libs";
import type { BaseMapProps, MapLayer, MapLayerConfig } from "../types";

const BaseMap: React.FC<BaseMapProps> = ({
  children,
  initialCenter = DEFAULT_CENTER,
  initialZoom = MAP_ZOOM_LEVEL,
  onMapRef,
}) => {
  const mapRef = useRef<MapRef>(null);
  const [selectedLayer, setSelectedLayer] = useState<MapLayer>("satellite");

  const mapLayers = useMemo<Record<MapLayer, MapLayerConfig>>(
    () => ({
      ast: {
        name: "Mapa de AST",
        icon: <IconMap size={20} />,
        style: "mapbox://styles/try4life/cmmf2nmlk00nb01qrhf2h9m5f",
      },
      street: {
        name: "Mapa de Calles",
        icon: <IconMap size={20} />,
        style: "mapbox://styles/mapbox/streets-v12",
      },
      dark: {
        name: "Mapa Oscuro",
        icon: <IconWorld size={20} />,
        style: "mapbox://styles/mapbox/dark-v11",
      },
      satellite: {
        name: "Satelital Clásico",
        icon: <IconSatellite size={20} />,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
      },
      smooth: {
        name: "Satelital Clear",
        icon: <IconMapPin size={20} />,
        style: "mapbox://styles/mapbox/satellite-v9",
      },
      light: {
        name: "Mapa Claro",
        icon: <IconSun size={20} />,
        style: "mapbox://styles/mapbox/light-v11",
      },
      outdoors: {
        name: "Aventuras / Outdoor",
        icon: <IconMountain size={20} />,
        style: "mapbox://styles/mapbox/outdoors-v12",
      },
      navigation_day: {
        name: "Navegación Día",
        icon: <IconNavigation size={20} />,
        style: "mapbox://styles/mapbox/navigation-day-v1",
      },
      navigation_night: {
        name: "Navegación Noche",
        icon: <IconMoon size={20} />,
        style: "mapbox://styles/mapbox/navigation-night-v1",
      },
      terrain: {
        name: "Relieve / Terreno",
        icon: <IconTrees size={20} />,
        style: "mapbox://styles/mapbox/outdoors-v12",
      },
      blueprint: {
        name: "Planos / Blueprint",
        icon: <IconLayout size={20} />,
        style: "mapbox://styles/mapbox/cj7qzzm1u20ia2rp6v7ndznb2",
      },
      standard: {
        name: "Mapbox Standard",
        icon: <IconStack size={20} />,
        style: "mapbox://styles/mapbox/standard",
      },
      traffic_day: {
        name: "Tráfico en Vivo",
        icon: <IconCar size={20} />,
        style: "mapbox://styles/mapbox/traffic-day-v2",
      },
      traffic_night: {
        name: "Tráfico Nocturno",
        icon: <IconBolt size={20} />,
        style: "mapbox://styles/mapbox/traffic-night-v2",
      },
      blank: {
        name: "Lienzo Vacío",
        icon: <IconSquare size={20} />,
        style: "mapbox://styles/mapbox/empty-v9",
      },

      // --- 15 NUEVAS CAPAS ADICIONALES ---
      streets_v11: {
        name: "Calles Clásico",
        icon: <IconRoad size={20} />,
        style: "mapbox://styles/mapbox/streets-v11",
      },
      light_v10: {
        name: "Claro Minimal",
        icon: <IconBrightnessUp size={20} />,
        style: "mapbox://styles/mapbox/light-v10",
      },
      dark_v10: {
        name: "Oscuro Profundo",
        icon: <IconMoonStars size={20} />,
        style: "mapbox://styles/mapbox/dark-v10",
      },
      emerald: {
        name: "Estilo Esmeralda",
        icon: <IconLeaf size={20} />,
        style: "mapbox://styles/mapbox/emerald-v8",
      },
      pencil: {
        name: "Dibujo Lápiz",
        icon: <IconPencil size={20} />,
        style: "mapbox://styles/mapbox/cj44mfrt20f082snj2se3v4lv",
      },
      terminal: {
        name: "Matrix / Terminal",
        icon: <IconTerminal2 size={20} />,
        style: "mapbox://styles/mapbox/cjdt368to39652rm94oizscu9",
      },
      decimal: {
        name: "Decimal (Clean)",
        icon: <IconNumber size={20} />,
        style: "mapbox://styles/mapbox/cj3k9u3l200132ss0nbi90n3p",
      },
      mineral: {
        name: "Mineral / Soft",
        icon: <IconRipple size={20} />,
        style: "mapbox://styles/mapbox/cj6m99v7e5o9r2ro09idk6773",
      },
      north_star: {
        name: "Estrella del Norte",
        icon: <IconCompass size={20} />,
        style: "mapbox://styles/mapbox/cj44m9p3h0f292snm239p4p2s",
      },
      ice_cream: {
        name: "Ice Cream (Pastel)",
        icon: <IconIceCream size={20} />,
        style: "mapbox://styles/mapbox/cj7at6m5i3p6v2rmsqf80t6f8",
      },
      moonlight: {
        name: "Luz de Luna",
        icon: <IconCloudMinus size={20} />,
        style: "mapbox://styles/mapbox/cj3k9ut30000z2rnma60ic924",
      },
      odyssey: {
        name: "Odisea (Sci-Fi)",
        icon: <IconRocket size={20} />,
        style: "mapbox://styles/mapbox/cj6m6v98v5mtl2rmv0qlu83f1",
      },
      bubble: {
        name: "Burbuja / Infantil",
        icon: <IconCircleDot size={20} />,
        style: "mapbox://styles/mapbox/cj7at6m5i3p6v2rmsqf80t6f8",
      },
      navigation_guidance_day: {
        name: "Guía de Ruta Día",
        icon: <IconSteeringWheel size={20} />,
        style: "mapbox://styles/mapbox/navigation-guidance-day-v4",
      },
      navigation_guidance_night: {
        name: "Guía de Ruta Noche",
        icon: <IconFocus2 size={20} />,
        style: "mapbox://styles/mapbox/navigation-guidance-night-v4",
      },
    }),
    [],
  );

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (map) {
      // Suprimir el error de terrain de Mapbox
      map.on('error', (e: any) => {
        if (e?.error?.message?.includes('updateTerrain')) {
          return; // Ignorar silenciosamente
        }
      });
    }
    onMapRef?.(mapRef.current);
  }, [onMapRef]);

  const handleLayerChange = useCallback((layer: MapLayer) => {
    setSelectedLayer(layer);
  }, []);

  return (
    <div
      style={{
        padding: 0.6,
      }}
      className="w-full h-full flex-1 bg-bg-100   overflow-hidden rounded relative animate-fade-in-down animate-duration-500 flex justify-center items-center"
    >
      <div className="absolute w-full h-full -bg-linear-120 rounded from-slate-700 to-brand-200/23"></div>
      <ReactMapGL
        key={selectedLayer}
        ref={mapRef}
        initialViewState={{
          longitude: initialCenter.longitude,
          latitude: initialCenter.latitude,
          zoom: initialZoom,
          pitch: 0,
          bearing: 0,
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={mapLayers[selectedLayer].style}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        reuseMaps={false}
        maxPitch={85}
        renderWorldCopies={false}
        fadeDuration={0}
        onLoad={handleMapLoad}
        onError={(e: any) => {
          if (e?.error?.message?.includes('updateTerrain')) {
            return;
          }
          console.warn('[Mapbox] Error:', e);
        }}
      >
        {children}
      </ReactMapGL>
      <div className="relative h-full  z-50 bg-bg-100  flex flex-col gap-1 p-1 rounded">
        <div className="flex flex-col p-0.5 gap-1 border border-border rounded py-1">
          <LayerSelector
            selectedLayer={selectedLayer}
            onLayerChange={handleLayerChange}
            mapLayers={mapLayers}
          />
          <ViewControls
            mapRef={mapRef}
            initialCenter={initialCenter}
            initialZoom={initialZoom}
          />
          <CustomZoomControl mapRef={mapRef} />
        </div>

        <div className="flex justify-center items-center h-full">
          <span className="[writing-mode:vertical-rl] truncate rotate-180 text-base tracking-[0.3em] text-text-300 font-light">
            Configuración Mapa
          </span>
        </div>
      </div>
    </div>
  );
};

export default BaseMap;
