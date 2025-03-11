import React, { useCallback } from 'react';

interface PolygonDrawingToolProps {
  onAreaUpdate?: (area: number) => void;
}

export const PolygonDrawingTool: React.FC<PolygonDrawingToolProps> = ({ onAreaUpdate }) => {
  // ... existing state declarations ...

  // Update the setArea calls to also trigger onAreaUpdate
  const updateArea = (newArea: number) => {
    setArea(newArea);
    onAreaUpdate?.(newArea);
  };

  // Update calculateArea usage in handleMapClick
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    const newPoints = [...points, newPoint];
    setPoints(newPoints);

    if (newPoints.length >= 3) {
      const newArea = calculateArea(newPoints);
      updateArea(newArea);
    }
  }, [isDrawing, points, onAreaUpdate]);

  // Update onPolygonLoad to use updateArea
  const onPolygonLoad = useCallback((polygon: google.maps.Polygon) => {
    polygonRef.current = polygon;
    
    const path = polygon.getPath();
    
    listenersRef.current.forEach(listener => {
      google.maps.event.removeListener(listener);
    });
    
    listenersRef.current = [
      google.maps.event.addListener(path, 'set_at', () => {
        const newPoints = getPathPoints(path);
        setPoints(newPoints);
        
        if (newPoints.length >= 3) {
          const newArea = calculateArea(newPoints);
          updateArea(newArea);
        }
      }),
      google.maps.event.addListener(path, 'insert_at', () => {
        const newPoints = getPathPoints(path);
        setPoints(newPoints);
        
        if (newPoints.length >= 3) {
          const newArea = calculateArea(newPoints);
          updateArea(newArea);
        }
      }),
      google.maps.event.addListener(path, 'remove_at', () => {
        const newPoints = getPathPoints(path);
        setPoints(newPoints);
        
        if (newPoints.length >= 3) {
          const newArea = calculateArea(newPoints);
          updateArea(newArea);
        }
      })
    ];
  }, [updateArea]);

  // ... rest of the component remains the same ...
}; 