import React, { useCallback } from "react";
import { IconPlus, IconMinus } from "@tabler/icons-react";
import type { CustomZoomControlProps } from "../types";
import LineGradientWhite from "@/components/ui/LineGradientWhite";

const CustomZoomControl: React.FC<CustomZoomControlProps> = React.memo(
  ({ mapRef }) => {
    const handleZoomIn = useCallback(() => {
      mapRef.current?.zoomIn();
    }, [mapRef]);

    const handleZoomOut = useCallback(() => {
      mapRef.current?.zoomOut();
    }, [mapRef]);

    return (
      <div className="flex flex-col gap-1">
        <div className="relative">
          {/* <LineGradientWhite top="-0.05rem" height="1.5rem" color={"white"} /> */}
          <button
            onClick={handleZoomIn}
            className="relative text-text-200 hover:text-text-100 outline outline-transparent p-0.5 bg-bg-300  shadow-lg shadow-bg-100 h-8 w-8 flex justify-center items-center transition-all"
            title="Acercar"
          >
            <IconPlus size={20} />
          </button>
        </div>
        <div className="relative">
          {/* <LineGradientWhite top="-0.05rem" height="1.5rem" color={"white"} /> */}
          <button
            onClick={handleZoomOut}
            className="relative text-text-200 hover:text-text-100 outline outline-transparent p-0.5 bg-bg-300  shadow-lg shadow-bg-100 h-8 w-8 flex justify-center items-center transition-all"
            title="Alejar"
          >
            <IconMinus size={20} />
          </button>
        </div>
      </div>
    );
  },
);

CustomZoomControl.displayName = "CustomZoomControl";

export default CustomZoomControl;
