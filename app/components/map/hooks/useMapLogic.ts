'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Field, PolygonPoint } from '../types';

const STORAGE_KEY = 'savedFields';

interface HistoryState {
  fields: Field[];
  currentField: Field | null;
}

export const useMapLogic = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [currentField, setCurrentField] = useState<Field | null>(null);
  const [area, setArea] = useState<number>(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [mapType, setMapType] = useState<'hybrid' | 'satellite' | 'roadmap' | 'terrain'>('hybrid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [perimeter, setPerimeter] = useState<number>(0);
  const [measurements, setMeasurements] = useState<{ length: number; width: number; }[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | string | null>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [tempPoints, setTempPoints] = useState<PolygonPoint[]>([]);
  const [isMovingPoint, setIsMovingPoint] = useState(false);
  const [userLocation, setUserLocation] = useState<PolygonPoint | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<{fieldId: string | null; index: number} | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Add refs for hover state to prevent re-renders
  const hoveredPointRef = useRef<number | string | null>(null);
  const isMovingRef = useRef(false);

  // Add ref for tracking drag state
  const dragStateRef = useRef<{
    isDragging: boolean;
    originalPoints: PolygonPoint[];
    currentIndex: number | null;
    fieldId: string | null;
  }>({
    isDragging: false,
    originalPoints: [],
    currentIndex: null,
    fieldId: null
  });

  // Add a ref to track the last update time for throttling
  const lastUpdateRef = useRef<number>(0);

  // Store current points in ref for immediate access
  const currentPointsRef = useRef<PolygonPoint[]>([]);
  const fieldIdRef = useRef<string | null>(null);

  // Add history management
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [shouldSaveToHistory, setShouldSaveToHistory] = useState(false);

  // Track polygon overlays
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const pathRef = useRef<google.maps.MVCArray<google.maps.LatLng> | null>(null);
  const linesRef = useRef<google.maps.Polyline[]>([]);

  // Load saved fields from localStorage on initial load
  useEffect(() => {
    try {
      const savedFields = localStorage.getItem(STORAGE_KEY);
      if (savedFields) {
        setFields(JSON.parse(savedFields));
        console.log('Loaded saved fields:', JSON.parse(savedFields));
      }
    } catch (error) {
      console.error('Error loading saved fields:', error);
    }
  }, []);

  // Save fields to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
      console.log('Saved fields to localStorage:', fields);
    } catch (error) {
      console.error('Error saving fields:', error);
    }
  }, [fields]);

  // Add a function to clear saved fields
  const clearSavedFields = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setFields([]);
      console.log('Cleared saved fields');
    } catch (error) {
      console.error('Error clearing saved fields:', error);
    }
  }, []);

  // Add function to save state to history
  const saveToHistory = useCallback(() => {
    if (!shouldSaveToHistory) return;

    const currentState: HistoryState = {
      fields,
      currentField
    };

    // Remove any future states if we're not at the end of history
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, currentState]);
    setHistoryIndex(prev => prev + 1);
    setShouldSaveToHistory(false);
  }, [fields, currentField, history, historyIndex, shouldSaveToHistory]);

  // Add undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setFields(previousState.fields);
      setCurrentField(previousState.currentField);
      setHistoryIndex(prev => prev - 1);
      setShouldSaveToHistory(false);
      
      // Reset movement states
      setTempPoints([]);
      setSelectedPoint(null);
      setSelectedFieldId(null);
      setIsMovingPoint(false);
      setHoveredPoint(null);
    }
  }, [history, historyIndex]);

  // Add redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setFields(nextState.fields);
      setCurrentField(nextState.currentField);
      setHistoryIndex(prev => prev + 1);
      setShouldSaveToHistory(false);
      
      // Reset movement states
      setTempPoints([]);
      setSelectedPoint(null);
      setSelectedFieldId(null);
      setIsMovingPoint(false);
      setHoveredPoint(null);
    }
  }, [history, historyIndex]);

  // Save initial state
  useEffect(() => {
    if (history.length === 0) {
      const initialState: HistoryState = {
        fields,
        currentField
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, []);

  // Watch for changes that should be saved to history
  useEffect(() => {
    if (!isMovingRef.current) {
      setShouldSaveToHistory(true);
    }
  }, [fields, currentField?.points]);

  // Save state to history when needed
  useEffect(() => {
    if (shouldSaveToHistory && !isMovingRef.current) {
      saveToHistory();
    }
  }, [shouldSaveToHistory, saveToHistory]);

  // Calculate area
  const calculateArea = useCallback((polygonPoints: PolygonPoint[]) => {
    if (!window.google || polygonPoints.length < 3) return 0;
    const polygon = new google.maps.Polygon({ paths: polygonPoints });
    const areaInSqMeters = google.maps.geometry.spherical.computeArea(polygon.getPath());
    return areaInSqMeters / 10000; // Convert to hectares
  }, []);

  // Calculate perimeter
  const calculatePerimeter = useCallback((polygonPoints: PolygonPoint[]): { totalDistance: number; lineMeasurements: { length: number; width: number; }[] } => {
    if (!window.google || polygonPoints.length < 2) return { totalDistance: 0, lineMeasurements: [] };
    let totalDistance = 0;
    const lineMeasurements: { length: number; width: number; }[] = [];

    for (let i = 0; i < polygonPoints.length; i++) {
      const point1 = polygonPoints[i];
      const point2 = polygonPoints[(i + 1) % polygonPoints.length];
      
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(point1.lat, point1.lng),
        new google.maps.LatLng(point2.lat, point2.lng)
      );
      
      totalDistance += distance;
      lineMeasurements.push({ length: distance, width: 0 });
    }

    return { totalDistance, lineMeasurements };
  }, []);

  // Calculate midpoint
  const calculateMidpoint = useCallback((point1: PolygonPoint, point2: PolygonPoint): PolygonPoint => {
    return {
      lat: (point1.lat + point2.lat) / 2,
      lng: (point1.lng + point2.lng) / 2,
    };
  }, []);

  // Handle midpoint drag
  const handleMidpointDrag = (e: google.maps.MapMouseEvent, index: number, fieldId: string | null) => {
    if (!e.latLng) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    // Insert new point at the midpoint position
    if (fieldId) {
      const field = fields.find(f => f.id === fieldId);
      if (field) {
        const newPoints = [...field.points];
        // Insert the new point after the current index
        newPoints.splice(index + 1, 0, newPoint);
        
        // Update field points
        field.points = newPoints;
        
        // Force immediate update
        setFields(prev => prev.map(f => 
          f.id === fieldId ? { ...f, points: newPoints } : f
        ));

        // Set this point as selected for dragging
        setSelectedPoint(index + 1);
        setSelectedFieldId(fieldId);
        setIsMovingPoint(true);

        // Update polygon and lines
        if (map) {
          // Update polygon path
          if (polygonRef.current) {
            polygonRef.current.setMap(null);
          }
          if (pathRef.current) {
            pathRef.current = null;
          }

          const path = new google.maps.MVCArray(
            newPoints.map(p => new google.maps.LatLng(p.lat, p.lng))
          );
          
          const polygon = new google.maps.Polygon({
            paths: path,
            map: map,
            strokeOpacity: 0,
            fillColor: '#00FF00',
            fillOpacity: 0.1,
          });
          
          polygonRef.current = polygon;
          pathRef.current = path;

          // Update lines
          linesRef.current.forEach(line => line.setMap(null));
          linesRef.current = [];

          const lines: google.maps.Polyline[] = [];
          for (let i = 0; i < newPoints.length; i++) {
            const start = newPoints[i];
            const end = newPoints[(i + 1) % newPoints.length];
            
            const line = new google.maps.Polyline({
              path: [
                new google.maps.LatLng(start.lat, start.lng),
                new google.maps.LatLng(end.lat, end.lng)
              ],
              map: map,
              strokeColor: '#00FF00',
              strokeOpacity: 1.0,
              strokeWeight: 2
            });
            lines.push(line);
          }
          linesRef.current = lines;
        }
      }
    } else if (currentField) {
      const newPoints = [...currentField.points];
      // Insert the new point after the current index
      newPoints.splice(index + 1, 0, newPoint);
      
      // Force immediate update
      setCurrentField({
        ...currentField,
        points: newPoints
      });

      // Set this point as selected for dragging
      setSelectedPoint(index + 1);
      setIsMovingPoint(true);

      // Update polygon and lines
      if (map) {
        // Update polygon path
        if (polygonRef.current) {
          polygonRef.current.setMap(null);
        }
        if (pathRef.current) {
          pathRef.current = null;
        }

        const path = new google.maps.MVCArray(
          newPoints.map(p => new google.maps.LatLng(p.lat, p.lng))
        );
        
        const polygon = new google.maps.Polygon({
          paths: path,
          map: map,
          strokeOpacity: 0,
          fillColor: '#00FF00',
          fillOpacity: 0.1,
        });
        
        polygonRef.current = polygon;
        pathRef.current = path;

        // Update lines
        linesRef.current.forEach(line => line.setMap(null));
        linesRef.current = [];

        const lines: google.maps.Polyline[] = [];
        for (let i = 0; i < newPoints.length; i++) {
          const start = newPoints[i];
          const end = newPoints[(i + 1) % newPoints.length];
          
          const line = new google.maps.Polyline({
            path: [
              new google.maps.LatLng(start.lat, start.lng),
              new google.maps.LatLng(end.lat, end.lng)
            ],
            map: map,
            strokeColor: '#00FF00',
            strokeOpacity: 1.0,
            strokeWeight: 2
          });
          lines.push(line);
        }
        linesRef.current = lines;
      }
    }

    // Disable map movement
    if (map) {
      map.setOptions({ 
        draggable: false,
        scrollwheel: false,
        gestureHandling: 'none'
      });
    }
  };

  // State object for easy access
  const state = {
    isDrawing,
    fields,
    currentField,
    area,
    showCreateMenu,
    mapType,
    isFullscreen,
    perimeter,
    measurements,
    selectedPoint,
    selectedFieldId,
    hoveredPoint,
    isDraggingMarker,
    tempPoints,
    isMovingPoint,
    userLocation,
    isLocating,
    editingMeasurement,
    map,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };

  // Modify handleCreateOption to save field when completed
  const handleCreateOption = useCallback((option: 'import' | 'field' | 'distance' | 'marker') => {
    if (option === 'field') {
      // If there's a current field with points, save it
      if (state.currentField?.points.length) {
        const finalField = {
          ...state.currentField,
          id: Date.now().toString()
        };
        setFields(prev => {
          const newFields = [...prev, finalField];
          // Save to localStorage
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newFields));
          } catch (error) {
            console.error('Error saving fields:', error);
          }
          return newFields;
        });
      }
      // Start new field
      setCurrentField({
        id: Date.now().toString(),
        points: [],
        area: 0,
        perimeter: 0,
        measurements: []
      });
      setIsDrawing(true);
    }
  }, [state]);

  // Format length
  const formatLength = useCallback((meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(1)} m`;
  }, []);

  // Adjust line length
  const adjustLineLength = useCallback((
    points: PolygonPoint[], 
    index: number, 
    newLength: number
  ): PolygonPoint[] => {
    if (!window.google) return points;
    const point1 = points[index];
    const point2 = points[(index + 1) % points.length];
    
    const currentLength = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(point1.lat, point1.lng),
      new google.maps.LatLng(point2.lat, point2.lng)
    );
    
    const scale = newLength / currentLength;
    
    const dx = point2.lng - point1.lng;
    const dy = point2.lat - point1.lat;
    
    const newPoint2 = {
      lat: point1.lat + (dy * scale),
      lng: point1.lng + (dx * scale)
    };
    
    const newPoints = [...points];
    newPoints[(index + 1) % points.length] = newPoint2;
    
    return newPoints;
  }, []);

  // Memoize hover handlers
  const handleMarkerHover = useCallback((index: number | string | null) => {
    hoveredPointRef.current = index;
    // Only update state if we're not moving a point to prevent re-renders during drag
    if (!isMovingRef.current) {
      setHoveredPoint(index);
    }
  }, []);

  // Initialize polygon and lines on movement start
  const handleMovementStart = (index: number, fieldId: string | null, points: PolygonPoint[]) => {
    setSelectedPoint(index);
    setSelectedFieldId(fieldId);
    
    // Clear any existing overlays
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    linesRef.current.forEach(line => line.setMap(null));
    linesRef.current = [];
    
    if (map) {
      // Create lines for each segment
      const lines: google.maps.Polyline[] = [];
      for (let i = 0; i < points.length; i++) {
        const start = points[i];
        const end = points[(i + 1) % points.length];
        
        const line = new google.maps.Polyline({
          path: [
            new google.maps.LatLng(start.lat, start.lng),
            new google.maps.LatLng(end.lat, end.lng)
          ],
          map: map,
          strokeColor: '#00FF00',
          strokeOpacity: 1.0,
          strokeWeight: 2
        });
        lines.push(line);
      }
      linesRef.current = lines;

      // Create the path for polygon
      const path = new google.maps.MVCArray(
        points.map(p => new google.maps.LatLng(p.lat, p.lng))
      );
      
      const polygon = new google.maps.Polygon({
        paths: path,
        map: map,
        strokeOpacity: 0,
        fillColor: '#00FF00',
        fillOpacity: 0.1,
      });
      
      polygonRef.current = polygon;
      pathRef.current = path;
    }
    
    // Disable map movement
    if (map) {
      map.setOptions({ 
        draggable: false,
        scrollwheel: false,
        gestureHandling: 'none'
      });
    }
  };

  // Super optimized drag handler with line updates
  const handleMarkerDrag = (e: google.maps.MapMouseEvent, index: number, fieldId: string | null) => {
    if (!e.latLng) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    // Update the point in memory and visuals
    if (fieldId) {
      const field = fields.find(f => f.id === fieldId);
      if (field) {
        // Update point in field without triggering state update
        field.points[index] = newPoint;
        
        // Update polygon path
        if (pathRef.current) {
          pathRef.current.setAt(index, e.latLng);
        }

        // Update connected lines
        if (linesRef.current.length > 0) {
          const points = field.points;
          // Update line before the point
          const prevIndex = (index - 1 + points.length) % points.length;
          const prevLine = linesRef.current[prevIndex];
          if (prevLine) {
            prevLine.setPath([
              new google.maps.LatLng(points[prevIndex].lat, points[prevIndex].lng),
              new google.maps.LatLng(newPoint.lat, newPoint.lng)
            ]);
          }
          
          // Update line after the point
          const nextLine = linesRef.current[index];
          if (nextLine) {
            nextLine.setPath([
              new google.maps.LatLng(newPoint.lat, newPoint.lng),
              new google.maps.LatLng(points[(index + 1) % points.length].lat, points[(index + 1) % points.length].lng)
            ]);
          }
        }
      }
    } else if (currentField) {
      // Update point in current field without triggering state update
      currentField.points[index] = newPoint;
      
      // Update polygon path
      if (pathRef.current) {
        pathRef.current.setAt(index, e.latLng);
      }

      // Update connected lines
      if (linesRef.current.length > 0) {
        const points = currentField.points;
        // Update line before the point
        const prevIndex = (index - 1 + points.length) % points.length;
        const prevLine = linesRef.current[prevIndex];
        if (prevLine) {
          prevLine.setPath([
            new google.maps.LatLng(points[prevIndex].lat, points[prevIndex].lng),
            new google.maps.LatLng(newPoint.lat, newPoint.lng)
          ]);
        }
        
        // Update line after the point
        const nextLine = linesRef.current[index];
        if (nextLine) {
          nextLine.setPath([
            new google.maps.LatLng(newPoint.lat, newPoint.lng),
            new google.maps.LatLng(points[(index + 1) % points.length].lat, points[(index + 1) % points.length].lng)
          ]);
        }
      }
    }
  };

  // Cleanup polygon and lines on movement end
  const handleMovementEnd = useCallback(() => {
    // Re-enable map movement
    if (map) {
      map.setOptions({ 
        draggable: true,
        scrollwheel: true,
        gestureHandling: 'greedy'
      });
    }

    // Remove temporary overlays
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
      pathRef.current = null;
    }
    linesRef.current.forEach(line => line.setMap(null));
    linesRef.current = [];

    // Update final state with all changes at once
    if (selectedFieldId) {
      const field = fields.find(f => f.id === selectedFieldId);
      if (field) {
        const newArea = calculateArea(field.points);
        const { totalDistance, lineMeasurements } = calculatePerimeter(field.points);
        setFields(prev => prev.map(f => 
          f.id === selectedFieldId 
            ? {
                ...f,
                points: [...field.points],
                area: newArea,
                perimeter: totalDistance,
                measurements: lineMeasurements
              }
            : f
        ));
      }
    } else if (currentField) {
      const newArea = calculateArea(currentField.points);
      const { totalDistance, lineMeasurements } = calculatePerimeter(currentField.points);
      setCurrentField({
        ...currentField,
        points: [...currentField.points],
        area: newArea,
        perimeter: totalDistance,
        measurements: lineMeasurements
      });
    }

    // Reset states
    setSelectedPoint(null);
    setSelectedFieldId(null);
    setHoveredPoint(null);
    setShouldSaveToHistory(true);
  }, [map, currentField, selectedFieldId, fields, calculateArea, calculatePerimeter]);

  // Optimize useEffect to prevent infinite loops
  useEffect(() => {
    if (!currentField || currentField.points.length < 3 || isMovingRef.current) return;

    // Use a debounced update
    const timeoutId = setTimeout(() => {
      const newArea = calculateArea(currentField.points);
      const { totalDistance, lineMeasurements } = calculatePerimeter(currentField.points);

      // Only update if values have changed significantly
      if (
        Math.abs(newArea - currentField.area) > 0.0001 ||
        Math.abs(totalDistance - currentField.perimeter) > 0.01 ||
        JSON.stringify(lineMeasurements) !== JSON.stringify(currentField.measurements)
      ) {
        setCurrentField(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            area: newArea,
            perimeter: totalDistance,
            measurements: lineMeasurements
          };
        });
      }
    }, 100); // Delay updates by 100ms

    return () => clearTimeout(timeoutId);
  }, [currentField?.points, calculateArea, calculatePerimeter]);

  // Memoize calculations object
  const calculations = useMemo(() => ({
    calculateArea,
    calculatePerimeter,
    calculateMidpoint,
    formatLength,
    adjustLineLength
  }), [calculateArea, calculatePerimeter, calculateMidpoint, formatLength, adjustLineLength]);

  // Add clearSavedFields and handleCreateOption to setters
  const setters = useMemo(() => ({
    setIsDrawing,
    setFields,
    setCurrentField,
    setArea,
    setShowCreateMenu,
    setMapType,
    setIsFullscreen,
    setPerimeter,
    setMeasurements,
    setSelectedPoint,
    setSelectedFieldId,
    setHoveredPoint,
    setIsDraggingMarker,
    setTempPoints,
    setIsMovingPoint,
    setUserLocation,
    setIsLocating,
    setEditingMeasurement,
    setMap,
    handleMarkerHover,
    handleMovementStart,
    handleMovementEnd,
    handleMarkerDrag,
    handleMidpointDrag,
    clearSavedFields,
    handleCreateOption,
    undo,
    redo
  }), [
    handleMarkerHover,
    handleMovementStart,
    handleMovementEnd,
    handleMarkerDrag,
    handleMidpointDrag,
    clearSavedFields,
    handleCreateOption,
    undo,
    redo
  ]);

  return {
    state,
    setters,
    calculations
  };
}; 