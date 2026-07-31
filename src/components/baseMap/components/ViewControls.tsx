import React, { useCallback } from "react";
import {
  IconMap,
  Icon3dCubeSphere,
  IconCompass,
  IconRefresh,
} from "@tabler/icons-react";
import type { ViewControlsProps } from "../types";
import LineGradientWhite from "@/components/ui/LineGradientWhite";

const ViewControls: React.FC<ViewControlsProps> = ({
  mapRef,
  initialCenter,
  initialZoom,
}) => {
  const setTopView = useCallback(() => {
    mapRef.current?.easeTo({
      pitch: 0,
      bearing: 0,
      duration: 1000,
    });
  }, [mapRef]);

  const set3DView = useCallback(() => {
    mapRef.current?.easeTo({
      pitch: 60,
      duration: 1000,
    });
  }, [mapRef]);

  const resetNorth = useCallback(() => {
    mapRef.current?.easeTo({
      bearing: 0,
      duration: 800,
    });
  }, [mapRef]);

  const resetView = useCallback(() => {
    mapRef.current?.flyTo({
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      duration: 1500,
    });
  }, [mapRef, initialCenter, initialZoom]);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative ">
        {/* <LineGradientWhite top="-0.05rem" height="1.5rem" color={"white"} /> */}
        <button
          onClick={setTopView}
          className="relative text-text-200 hover:text-text-100 outline outline-transparent p-0.5 bg-bg-300  shadow-lg shadow-bg-100 h-8 w-8 flex justify-center items-center transition-all"
          title="Vista superior (2D)"
        >
          <IconMap size={20} />
        </button>
      </div>
      <div className="relative ">
        {/* <LineGradientWhite top="-0.05rem" height="1.5rem" color={"white"} /> */}
        <button
          onClick={set3DView}
          className="relative text-text-200 hover:text-text-100 outline outline-transparent p-0.5 bg-bg-300  shadow-lg shadow-bg-100 h-8 w-8 flex justify-center items-center transition-all"
          title="Vista 3Dq"
        >
          <Icon3dCubeSphere size={20} />
        </button>
      </div>
      <div className="relative ">
        {/* <LineGradientWhite top="-0.05rem" height="1.5rem" color={"white"} /> */}
        <button
          onClick={resetNorth}
          className="relative text-text-200 hover:text-text-100 outline outline-transparent p-0.5 bg-bg-300  shadow-lg shadow-bg-100 h-8 w-8 flex justify-center items-center transition-all"
          title="Orientar al norte"
        >
          <IconCompass size={20} />
        </button>
      </div>
      <div className="relative ">
        {/* <LineGradientWhite top="-0.05rem" height="1.5rem" color={"white"} /> */}
        <button
          onClick={resetView}
          className="relative text-text-200 hover:text-text-100 outline outline-transparent p-0.5 bg-bg-300  shadow-lg shadow-bg-100 h-8 w-8 flex justify-center items-center transition-all"
          title="Resetear vista"
        >
          <IconRefresh size={20} />
        </button>
      </div>
    </div>
  );
};

export default ViewControls;
