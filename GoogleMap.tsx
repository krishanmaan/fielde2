import { FC } from 'react';
import PolygonDrawingTool from './PolygonDrawingTool';

interface GoogleMapProps {
  onAreaUpdate: (area: number) => void;
}

const GoogleMap: FC<GoogleMapProps> = ({ onAreaUpdate }) => {
  return (
    <div className="w-full h-full">
      <PolygonDrawingTool onAreaUpdate={onAreaUpdate} />
    </div>
  );
};

export default GoogleMap; 