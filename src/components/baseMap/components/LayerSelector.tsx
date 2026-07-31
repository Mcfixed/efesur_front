import React, { useState } from "react";
import { IconMapCog, IconRosetteDiscountCheck } from "@tabler/icons-react";
import type { LayerSelectorProps, MapLayer } from "../types";
import LineGradientWhite from "@/components/ui/LineGradientWhite";

const LayerSelector: React.FC<LayerSelectorProps> = ({
  selectedLayer,
  onLayerChange,
  mapLayers,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleLayerSelect = (layer: MapLayer) => {
    onLayerChange(layer);
    setShowMenu(false);
  };

  return (
    <div className="z-50">
      <div className="relative">
        {/* <LineGradientWhite top="-0.05rem" height="1.5rem" color={"white"} /> */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`
            ${showMenu ? "bg-bg-100 text-text-200  z-100" : "bg-bg-300"}
             relative text-text-200 hover:text-text-100 outline outline-transparent p-0.5   shadow-lg shadow-bg-100 h-8 w-8 flex justify-center items-center transition-all`}
        >
          <IconMapCog size={20} />
        </button>

        {showMenu && (
          <>
            {/* Overlay para cerrar el menú al hacer clic fuera */}
            <div
              className="fixed inset-0 z-40 "
              onClick={() => setShowMenu(false)}
            />

            <div className="absolute top-0 max-h-150 animate-fade-in-left animate-duration-100 overflow-y-scroll right-9 bg-bg-100 border border-border  shadow-xl p-3 min-w-60 z-50">
              {/* Capa seleccionada actual */}
              <div className="flex bg-bg-200 gap-2 font-medium mb-3 border border-border p-2 justify-center items-center text-text-200">
                {mapLayers[selectedLayer].icon}
                {mapLayers[selectedLayer].name}
                <IconRosetteDiscountCheck size={20} className="text-lime-300" />
              </div>

              {/* Lista de capas */}
              {Object.entries(mapLayers).map(([key, layer]) => (
                <button
                  key={key}
                  onClick={() => handleLayerSelect(key as MapLayer)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors rounded mb-1 ${
                    selectedLayer === key
                      ? "bg-bg-200 text-text-100"
                      : "hover:bg-bg-200 text-text-200 hover:text-text-100"
                  }`}
                >
                  {layer.icon}
                  <span className="font-medium">{layer.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LayerSelector;
