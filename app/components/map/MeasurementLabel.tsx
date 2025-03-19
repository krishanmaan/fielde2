'use client';

import React, { useState } from 'react';
import { OverlayView, Marker } from '@react-google-maps/api';
import { PolygonPoint } from './types';

interface MeasurementLabelProps {
  position: google.maps.LatLngLiteral;
  text: string;
  isEditing: boolean;
  onEditStart: () => void;
  onLengthChange: (length: number) => void;
  onCancel: () => void;
}

const MeasurementLabel: React.FC<MeasurementLabelProps> = ({
  position,
  text,
  isEditing,
  onEditStart,
  onLengthChange,
  onCancel
}) => {
  const [inputValue, setInputValue] = useState(text);
  const isKilometers = text.includes('km');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const numericValue = parseFloat(inputValue);
      if (!isNaN(numericValue)) {
        onLengthChange(numericValue);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(width, height) => ({
        x: -(width / 2),
        y: -(height / 2)
      })}
    >
      <div 
        className="measurement-label"
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -150%)',
          backgroundColor: isKilometers ? '#ff0000' : '#ffffff',
          padding: '4px',
          width: '56px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1000,
          cursor: 'pointer'
        }}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          if (!isEditing) {
            onEditStart();
          }
        }}
      >
        {isEditing ? (
          <div className="measurement-input-container">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="measurement-input"
              style={{
                width: '60px',
                border: '1px solid #ccc',
                borderRadius: '2px',
                padding: '1px'
              }}
              autoFocus
            />
          </div>
        ) : (
          text
        )}
      </div>
    </OverlayView>
  );
};

export default MeasurementLabel; 