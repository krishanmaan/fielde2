'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLayerGroup,
  faLocationCrosshairs,
  faExpand
} from '@fortawesome/free-solid-svg-icons';

interface MapControlsProps {
  onToggleMapType: () => void;
  onLocationClick: () => void;
  onToggleFullscreen: () => void;
}

const MapControls = ({ 
  onToggleMapType, 
  onLocationClick, 
  onToggleFullscreen 
}: MapControlsProps) => {
  return (
    <div className="absolute right-3 top-6 flex flex-col gap-2">
      <button 
        onClick={onToggleMapType}
        className="bg-black bg-opacity-60 w-12 h-12 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition-colors"
      >
        <FontAwesomeIcon icon={faLayerGroup} className="h-5 w-5 text-white" />
      </button>
      <button 
        onClick={onLocationClick}
        className="bg-[#FF4C4C] w-12 h-12 rounded-lg flex items-center justify-center hover:bg-[#FF3C3C] transition-colors"
      >
        <FontAwesomeIcon icon={faLocationCrosshairs} className="h-5 w-5 text-white" />
      </button>
      <button 
        onClick={onToggleFullscreen}
        className="bg-black bg-opacity-60 w-12 h-12 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition-colors"
      >
        <FontAwesomeIcon icon={faExpand} className="h-5 w-5 text-white" />
      </button>
    </div>
  );
};

export default MapControls; 