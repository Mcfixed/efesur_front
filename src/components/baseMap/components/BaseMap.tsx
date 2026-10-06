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
  IconStack,
  IconCar,
  IconBolt,
  IconRoad,
  IconBrightnessUp,
  IconMoonStars,
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
  initialPitch = 0,
  initialBearing = 0,
  onMapRef,
}) => {
  const mapRef = useRef<MapRef>(null);
  // Estilo inicial: satélite con nombres. Pintar la imagen satelital es liviano; el costo
  // está en las capas vectoriales completas de `satellite-streets-v12` (trazado de calles,
  // edificios y ~50 capas de etiquetas). Por eso se usa un estilo propio: la misma imagen
  // más las capas de texto que aportan. Los demás estilos siguen en el selector.
  const [selectedLayer, setSelectedLayer] = useState<MapLayer>("smooth_labels");

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
      // Satélite + nombres: la misma imagen satelital, más las capas de texto del vector
      // tile de Mapbox (ciudades, calles, ferrocarril, estaciones, nombres naturales,
      // escudos de ruta) y los límites administrativos propios (public/geo).
      smooth_labels: {
        name: "Satélite + Nombres",
        icon: <IconMapPin size={20} />,
        style: {
          version: 8,
          glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
          // Requerido por la capa de escudos de ruta (los óvalos con el número)
          sprite: "mapbox://sprites/mapbox/streets-v12",
          sources: {
            imagen: { type: "raster", url: "mapbox://mapbox.satellite", tileSize: 512 },
            mapbox: { type: "vector", url: "mapbox://mapbox.mapbox-streets-v8" },
            // Límites administrativos: geometría propia simplificada (fuente: geoBoundaries,
            // CC-BY 4.0, ver crédito en el HUD del mapa). El tileset de Mapbox sólo trae
            // fronteras de país, no regiones ni comunas.
            regiones: { type: "geojson", data: "/geo/regiones.geojson" },
            provincias: { type: "geojson", data: "/geo/provincias.geojson" },
          },
          layers: [
            {
              id: "imagen-satelital",
              type: "raster",
              source: "imagen",
              paint: { "raster-fade-duration": 0 },
            },
            {
              // Límites provinciales: tenues, para no competir con la imagen.
              // Se apagan en zoom de ciudad: a ese nivel no aportan y son la geometría
              // más pesada del mapa (decenas de miles de vértices por frame).
              id: "limites-provincias",
              type: "line",
              source: "provincias",
              minzoom: 7,
              maxzoom: 11,
              paint: {
                "line-color": "#e5e7eb",
                "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.4, 12, 1.0],
                "line-dasharray": [2, 2],
                "line-opacity": 0.35,
              },
            },
            {
              // Límites regionales: más visibles, con el mismo criterio de zoom
              id: "limites-regiones",
              type: "line",
              source: "regiones",
              minzoom: 4,
              maxzoom: 12,
              paint: {
                "line-color": "#fbbf24",
                "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 10, 1.4],
                "line-opacity": 0.55,
              },
            },
            {
              // Nombres de elementos naturales: cerros, volcanes, ríos, lagos, parques
              id: "nombres-naturales",
              type: "symbol",
              source: "mapbox",
              "source-layer": "natural_label",
              minzoom: 6,
              filter: [
                "in",
                ["get", "class"],
                ["literal", ["landform", "water", "river", "peak", "volcano", "bay", "sea", "ocean", "desert", "park", "reserve"]],
              ],
              layout: {
                "text-field": ["get", "name"],
                "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
                "text-size": 11,
                "text-padding": 5,
              },
              paint: { "text-color": "#a7f3d0", "text-halo-color": "rgba(0,0,0,.8)", "text-halo-width": 1.2 },
            },
            {
              // Nombre de los enlaces/rampas de autopista. En los datos de Chile son muy
              // pocos los que traen nombre; se ven sólo en enlaces grandes.
              id: "enlaces-autopista",
              type: "symbol",
              source: "mapbox",
              "source-layer": "motorway_junction",
              minzoom: 9,
              layout: {
                "text-field": ["get", "name"],
                "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
                "text-size": 10,
                "text-padding": 4,
              },
              paint: { "text-color": "#93c5fd", "text-halo-color": "rgba(0,0,0,.8)", "text-halo-width": 1.2 },
            },
            {
              // Escudos de ruta (Ruta 5, 68, rutas regionales tipo 6-50).
              // El número sale de road.ref y el óvalo del sprite de streets-v12.
              id: "escudos-ruta",
              type: "symbol",
              source: "mapbox",
              "source-layer": "road",
              minzoom: 7,
              filter: ["all", ["has", "reflen"], [">", ["to-number", ["get", "reflen"]], 0]],
              layout: {
                "icon-image": ["concat", "default_", ["get", "reflen"]],
                "text-field": ["get", "ref"],
                "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                "text-size": 9,
                "icon-allow-overlap": true,
                "text-allow-overlap": true,
              },
              paint: { "text-color": ["get", "shield_text_color"] },
            },
            {
              id: "ciudades",
              type: "symbol",
              source: "mapbox",
              "source-layer": "place_label",
              minzoom: 5,
              layout: {
                "text-field": ["get", "name"],
                "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 12, 15],
                "text-padding": 6,
              },
              paint: {
                "text-color": "#ffffff",
                "text-halo-color": "rgba(0,0,0,.75)",
                "text-halo-width": 1.3,
              },
            },
            {
              id: "nombres-calles",
              type: "symbol",
              source: "mapbox",
              "source-layer": "road",
              minzoom: 14,
              layout: {
                "text-field": ["get", "name"],
                "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
                "text-size": 12,
                "symbol-placement": "line",
                "text-rotation-alignment": "map",
              },
              paint: {
                "text-color": "#ffffff",
                "text-halo-color": "rgba(0,0,0,.75)",
                "text-halo-width": 1.3,
              },
            },
            {
              // Vía férrea y metro. En Mapbox Streets v8 el ferrocarril es
              // class = 'major_rail' | 'minor_rail' (no 'rail').
              id: "ferrocarril",
              type: "line",
              source: "mapbox",
              "source-layer": "road",
              filter: ["in", ["get", "class"], ["literal", ["major_rail", "minor_rail"]]],
              minzoom: 8,
              paint: {
                "line-color": "#e5e7eb",
                "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 1.8],
                "line-dasharray": [3, 2],
                "line-opacity": 0.9,
              },
            },
            {
              // Sólo estaciones de metro/tren: de 5.390 paradas de la vista, las de
              // 'mode' metro/rail son ~118 (el resto son paradas de bus y sí son caras).
              id: "estaciones",
              type: "symbol",
              source: "mapbox",
              "source-layer": "transit_stop_label",
              filter: ["in", ["get", "mode"], ["literal", ["metro_rail", "rail", "light_rail"]]],
              minzoom: 12,
              layout: {
                "text-field": ["get", "name"],
                "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
                "text-size": 11,
                "text-padding": 4,
              },
              paint: {
                "text-color": "#fbbf24",
                "text-halo-color": "rgba(0,0,0,.8)",
                "text-halo-width": 1.2,
              },
            },
          ],
        },
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
    <div className="w-full h-full flex-1 overflow-hidden relative animate-fade-in-down animate-duration-500">
      <ReactMapGL
        key={selectedLayer}
        ref={mapRef}
        initialViewState={{
          longitude: initialCenter.longitude,
          latitude: initialCenter.latitude,
          zoom: initialZoom,
          pitch: initialPitch,
          bearing: initialBearing,
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
      <div className="absolute right-1 top-1 h-[calc(100%-8px)] z-50 bg-bg-100/90 backdrop-blur-sm flex flex-col gap-1 p-1 rounded">
        <div className="flex flex-col p-0.5 gap-1  rounded py-1">
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
