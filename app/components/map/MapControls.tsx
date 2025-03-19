'use client';

import React from 'react';
import { FaMapMarkedAlt, FaLocationArrow, FaExpand, FaCompress, FaTrash } from 'react-icons/fa';
import MapTypeMenu from './MapTypeMenu';

type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

interface MapControlsProps {
  currentMapType: MapType;
  onMapTypeChange: (type: MapType) => void;
  onLocationClick: () => void;
  onToggleFullscreen: () => void;
  onClearFields: () => void;
  isLocating: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
  currentMapType,
  onMapTypeChange,
  onLocationClick,
  onToggleFullscreen,
  onClearFields,
  isLocating
}) => {
  return (
    <div className="absolute bottom-35 right-6 flex flex-col gap-2 ">
      <button
        onClick={() => onMapTypeChange(currentMapType)}
        className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
        title="Change map type"
      >
        <FaMapMarkedAlt className="text-gray-700 text-xl" />
      </button>
      <button
        onClick={onLocationClick}
        className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
        title="Go to my location"
        disabled={isLocating}
      >
        <FaLocationArrow className={`text-xl ${isLocating ? 'text-gray-400 animate-spin' : 'text-gray-700'}`} />
      </button>
      <button
        onClick={onToggleFullscreen}
        className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
        title="Toggle fullscreen"
      >
        {document.fullscreenElement ? (
          <FaCompress className="text-gray-700 text-xl" />
        ) : (
          <FaExpand className="text-gray-700 text-xl" />
        )}
      </button>
      <button
        onClick={onClearFields}
        className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
        title="Clear all fields"
      >
        <FaTrash className="text-red-500 text-xl" />
      </button>
    </div>
  );
};

export default MapControls; 