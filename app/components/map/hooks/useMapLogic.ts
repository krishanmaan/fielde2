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

  // Update handleMarkerDrag to prevent excessive updates
  const handleMarkerDrag = (e: google.maps.MapMouseEvent, index: number, fieldId: string | null) => {
    if (!e.latLng) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    // Update both tempPoints and field points together for synchronized movement
    if (isMovingRef.current) {
      const newTempPoints = [...tempPoints];
      newTempPoints[index] = newPoint;
      
      // Update tempPoints immediately
      setTempPoints(newTempPoints);
      
      // Update field points immediately
      if (fieldId) {
        setFields(prev => {
          const field = prev.find(f => f.id === fieldId);
          if (!field) return prev;
          return prev.map(f => {
            if (f.id === fieldId) {
              return {
                ...f,
                points: newTempPoints
              };
            }
            return f;
          });
        });
      } else if (currentField) {
        setCurrentField(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            points: newTempPoints
          };
        });
      }
    }
  };

  // Update movement start to initialize points correctly
  const handleMovementStart = (index: number, fieldId: string | null, points: PolygonPoint[]) => {
    setSelectedPoint(index);
    setSelectedFieldId(fieldId);
    setIsMovingPoint(true);
    
    // Initialize points
    const initialPoints = [...points];
    setTempPoints(initialPoints);
    isMovingRef.current = true;
    
    // Disable map dragging during point movement
    if (map) {
      map.setOptions({ 
        draggable: false,
        scrollwheel: false,
        gestureHandling: 'none'
      });
    }
  };

  // Handle movement end
  const handleMovementEnd = useCallback(() => {
    if (map) {
      map.setOptions({ 
        draggable: true,
        scrollwheel: true,
        gestureHandling: 'greedy'
      });
    }

    // Update final measurements after movement ends
    if (currentField && currentField.points.length >= 3) {
      const newArea = calculateArea(currentField.points);
      const { totalDistance, lineMeasurements } = calculatePerimeter(currentField.points);
      
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

    setIsMovingPoint(false);
    setSelectedPoint(null);
    setSelectedFieldId(null);
    setHoveredPoint(null);
    isMovingRef.current = false;
    setShouldSaveToHistory(true);
  }, [map, currentField, calculateArea, calculatePerimeter]);

  // Update area and measurements when points change
  useEffect(() => {
    if (!currentField || currentField.points.length < 3 || isMovingRef.current) return;

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
    clearSavedFields,
    handleCreateOption,
    undo,
    redo
  }), [
    handleMarkerHover,
    handleMovementStart,
    handleMovementEnd,
    handleMarkerDrag,
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