'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, LoadScript, Polygon, Polyline, Marker, Circle, OverlayView } from '@react-google-maps/api';
import Navbar from './Navbar';
import MapControls from './MapControls';
import CreateMenu from './CreateMenu';
import ZoomControls from './ZoomControls';
import AreaDisplay from './AreaDisplay';
import FieldMeasurements from './FieldMeasurements';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot } from '@fortawesome/free-solid-svg-icons';
import SearchBox from './SearchBox';

interface PolygonPoint {
  lat: number;
  lng: number;
}

type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

const libraries: ("drawing" | "geometry" | "places")[] = ["drawing", "geometry", "places"];

const mapStyles = {
  container: {
    width: '100%',
    height: 'calc(100vh - 48px)',
    position: 'relative' as const
  },
  map: {
    width: '100%',
    height: '100%'
  }
};

const defaultCenter = {
  lat: 27.342860470286933, 
  lng: 75.79046143662488,
};

interface MapComponentProps {
  onAreaUpdate?: (area: number) => void;
}

// Define marker path as a string constant
const MARKER_PATH = "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z";

interface Field {
  id: string;
  points: PolygonPoint[];
  area: number;
  perimeter: number;
  measurements: { length: number; width: number; }[];
}

// Update styles to include corner labels and clickable measurement labels
const styles = document.createElement('style');
styles.textContent = `
  .measurement-label {
    background-color: rgba(255, 255, 255, 0.8);
    padding: 2px 4px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .measurement-label:hover {
    background-color: rgba(255, 255, 255, 0.95);
  }
  .corner-label {
    background-color: rgba(255, 255, 255, 0.9);
    padding: 0px 6px;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .measurement-input-container {
    background-color: white;
    padding: 2px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  .measurement-input {
    outline: none;
    text-align: center;
  }
  .measurement-input:focus {
    border-color: #4285F4;
  }
`;
document.head.appendChild(styles);

// Update MeasurementLabel component
const MeasurementLabel = ({ 
  position, 
  text, 
  isEditing, 
  onEditStart, 
  onLengthChange,
  onCancel
}: { 
  position: PolygonPoint; 
  text: string;
  isEditing: boolean;
  onEditStart: () => void;
  onLengthChange: (newLength: number) => void;
  onCancel: () => void;
}) => {
  const [inputValue, setInputValue] = useState(text.replace(' m', '').replace(' km', ''));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const newLength = parseFloat(inputValue);
      if (!isNaN(newLength)) {
        onLengthChange(newLength);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleClick = (e: google.maps.MapMouseEvent) => {
    e.domEvent.stopPropagation();
    if (!isEditing) {
      onEditStart();
    }
  };

  if (isEditing) {
    return (
      <OverlayView
        position={position}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      >
        <div 
          className="measurement-input-container"
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '4px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="measurement-input"
            autoFocus
            style={{
              width: '70px',
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          />
          <span style={{ marginLeft: '4px', fontSize: '14px' }}>m</span>
        </div>
      </OverlayView>
    );
  }

  return (
    <Marker
      position={position}
      icon={{
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
        fillOpacity: 0,
        strokeOpacity: 0,
      }}
      label={{
        text: text,
        color: '#000000',
        fontSize: '14px',
        fontWeight: 'bold',
        className: 'measurement-label',
      }}
      onClick={handleClick}
      options={{
        clickable: true
      }}
    />
  );
};

// Add new component for corner labels
const CornerLabel = ({ position, text }: { position: PolygonPoint; text: string }) => {
  return (
    <Marker
      position={position}
      icon={{
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
        fillOpacity: 0,
        strokeOpacity: 0,
      }}
      label={{
        text: text,
        color: '#000000',
        fontSize: '16px',
        fontWeight: 'bold',
        className: 'corner-label',
      }}
      zIndex={1001}
    />
  );
};

const MapComponent = ({ onAreaUpdate }: MapComponentProps) => {
  // All hooks need to be at the top level
  const [isClient, setIsClient] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [currentField, setCurrentField] = useState<Field | null>(null);
  const [area, setArea] = useState<number>(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [perimeter, setPerimeter] = useState<number>(0);
  const [measurements, setMeasurements] = useState<{ length: number; width: number; }[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [tempPoints, setTempPoints] = useState<PolygonPoint[]>([]);
  const [isMovingPoint, setIsMovingPoint] = useState(false);
  const [userLocation, setUserLocation] = useState<PolygonPoint | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<{fieldId: string | null; index: number} | null>(null);

  // Add ref to track if we're dragging
  const isDraggingRef = useRef(false);

  // Add state for tracking marker movement
  const [isMovingMarker, setIsMovingMarker] = useState(false);

  // Define marker icon inside component where google object is available
  const getRedMarkerIcon = useCallback(() => ({
    path: MARKER_PATH,
    fillColor: '#FF0000',
    fillOpacity: 1,
    strokeWeight: 1,
    strokeColor: '#000000',
    scale: 1.5,
    anchor: new google.maps.Point(0, 0),
  }), []);

  // Map event handlers
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Area calculation
  const calculateArea = useCallback((polygonPoints: PolygonPoint[]) => {
    if (polygonPoints.length < 3) return 0;
    const polygon = new google.maps.Polygon({ paths: polygonPoints });
    const areaInSqMeters = google.maps.geometry.spherical.computeArea(polygon.getPath());
    return areaInSqMeters / 10000; // Convert to hectares
  }, []);

  // Add perimeter calculation
  const calculatePerimeter = useCallback((polygonPoints: PolygonPoint[]): { totalDistance: number; lineMeasurements: { length: number; width: number; }[] } => {
    if (polygonPoints.length < 2) return { totalDistance: 0, lineMeasurements: [] };
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

  // Map click handler
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    if (!currentField) {
      // Create new field if none exists
      const newField: Field = {
        id: Date.now().toString(),
        points: [newPoint],
        area: 0,
        perimeter: 0,
        measurements: []
      };
      setCurrentField(newField);
    } else {
      // Add point to current field
      setCurrentField(prev => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, newPoint]
        };
      });
    }
  }, [isDrawing, currentField]);

  // Use useEffect to handle area and perimeter updates
  useEffect(() => {
    if (currentField && currentField.points.length >= 3) {
      const newArea = calculateArea(currentField.points);
      const { totalDistance, lineMeasurements } = calculatePerimeter(currentField.points);
      
      setArea(newArea);
      setPerimeter(totalDistance);
      setMeasurements(lineMeasurements);
      
      setCurrentField(prev => {
        if (!prev) return null;
        return {
          ...prev,
          area: newArea,
          perimeter: totalDistance,
          measurements: lineMeasurements
        };
      });

      if (onAreaUpdate) {
        onAreaUpdate(newArea);
      }
    }
  }, [currentField?.points, calculateArea, calculatePerimeter, onAreaUpdate]);

  // Map controls handlers
  const handleToggleMapType = useCallback(() => {
    setMapType(prev => {
      switch (prev) {
        case 'hybrid':
          return 'satellite';
        case 'satellite':
          return 'roadmap';
        case 'roadmap':
          return 'terrain';
        case 'terrain':
          return 'hybrid';
        default:
          return 'hybrid';
      }
    });
  }, []);

  const handleLocationClick = useCallback(() => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLocation);
          if (map) {
            map.panTo(newLocation);
            map.setZoom(18);
          }
          setIsLocating(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsLocating(false);
          alert('Unable to get your location. Please check your location permissions.');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
      setIsLocating(false);
    }
  }, [map]);

  const handleToggleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (!isFullscreen) {
      elem.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleZoomIn = useCallback(() => {
    if (map) {
      map.setZoom((map.getZoom() || 15) + 1);
    }
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (map) {
      map.setZoom((map.getZoom() || 15) - 1);
    }
  }, [map]);

  // Create menu handlers
  const handleCreateOption = useCallback((option: 'import' | 'field' | 'distance' | 'marker') => {
    setShowCreateMenu(false);
    if (option === 'field') {
      // If there's a current field, add it to fields array
      if (currentField) {
        const { totalDistance, lineMeasurements } = calculatePerimeter(currentField.points);
        const finalField = {
          ...currentField,
          perimeter: totalDistance,
          measurements: lineMeasurements
        };
        setFields(prev => [...prev, finalField]);
      }
      // Create new empty field
      setCurrentField({
        id: Date.now().toString(),
        points: [],
        area: 0,
        perimeter: 0,
        measurements: []
      });
      setIsDrawing(true);
    }
  }, [currentField, calculatePerimeter]);

  // Update map options
  const mapOptions = useMemo(() => ({
    mapTypeId: mapType,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: false,
    scaleControl: true,
    rotateControl: false,
    panControl: false,
    scrollwheel: !isMovingMarker,
    clickableIcons: false,
    disableDefaultUI: true,
    tilt: 0,
    gestureHandling: isMovingMarker ? 'none' : 'cooperative',
    draggableCursor: isDrawing ? 'crosshair' : 'grab',
    draggingCursor: 'move',
    draggable: !isMovingMarker,
  }), [mapType, isDrawing, isMovingMarker]);

  // Update marker handlers
  const handleMarkerClick = useCallback((index: number, fieldId: string | null) => {
    setSelectedPoint(index);
    setSelectedFieldId(fieldId);
    setIsMovingMarker(true);
    setIsMovingPoint(true);
    // Store temporary points for preview
    const fieldToEdit = fieldId ? fields.find(f => f.id === fieldId) : currentField;
    if (fieldToEdit) {
      setTempPoints([...fieldToEdit.points]);
    }
    if (map) {
      map.setOptions({ 
        draggable: false,
        scrollwheel: false,
        gestureHandling: 'none'
      });
    }
  }, [map, fields, currentField]);

  // Add marker hover handlers
  const handleMarkerMouseEnter = (index: number) => {
    setHoveredPoint(index);
  };

  const handleMarkerMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Add marker movement handlers
  const handleMarkerDragStart = useCallback((e: google.maps.MapMouseEvent, fieldId: string | null) => {
    e.domEvent.stopPropagation();
    setIsMovingMarker(true);
    setIsMovingPoint(true);
    const fieldToEdit = fieldId ? fields.find(f => f.id === fieldId) : currentField;
    if (fieldToEdit) {
      setTempPoints([...fieldToEdit.points]);
    }
    if (map) {
      map.setOptions({ 
        draggable: false,
        scrollwheel: false,
        gestureHandling: 'none'
      });
    }
  }, [map, fields, currentField]);

  const handleMarkerDragEnd = useCallback((fieldId: string | null) => {
    setIsMovingMarker(false);
    setIsMovingPoint(false);
    if (fieldId) {
      // Update completed field
      setFields(prevFields => 
        prevFields.map(field => {
          if (field.id === fieldId) {
            const newArea = calculateArea(tempPoints);
            const { totalDistance, lineMeasurements } = calculatePerimeter(tempPoints);
            return {
              ...field,
              points: [...tempPoints],
              area: newArea,
              perimeter: totalDistance,
              measurements: lineMeasurements
            };
          }
          return field;
        })
      );
    } else {
      // Update current field
      setCurrentField(prev => {
        if (!prev) return null;
        const newArea = calculateArea(tempPoints);
        const { totalDistance, lineMeasurements } = calculatePerimeter(tempPoints);
        return {
          ...prev,
          points: [...tempPoints],
          area: newArea,
          perimeter: totalDistance,
          measurements: lineMeasurements
        };
      });
    }
    setTempPoints([]);
    if (map) {
      map.setOptions({ 
        draggable: true,
        scrollwheel: true,
        gestureHandling: 'cooperative'
      });
    }
  }, [map, tempPoints, calculateArea, calculatePerimeter]);

  const handleMarkerDrag = useCallback((index: number, newPosition: google.maps.LatLng) => {
    if (!isMovingMarker) return;
    
    setTempPoints(prevPoints => {
      const newPoints = [...prevPoints];
      newPoints[index] = {
        lat: newPosition.lat(),
        lng: newPosition.lng()
      };
      return newPoints;
    });
  }, [isMovingMarker]);

  // Add handler for search location select
  const handlePlaceSelect = useCallback((location: google.maps.LatLng) => {
    if (map) {
      map.panTo(location);
      map.setZoom(18);
    }
  }, [map]);

  // Add function to calculate midpoint between two points
  const calculateMidpoint = useCallback((point1: PolygonPoint, point2: PolygonPoint): PolygonPoint => {
    return {
      lat: (point1.lat + point2.lat) / 2,
      lng: (point1.lng + point2.lng) / 2,
    };
  }, []);

  // Add function to format length in meters to a readable format
  const formatLength = useCallback((meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(1)} m`;
  }, []);

  // Add function to adjust line length
  const adjustLineLength = useCallback((
    points: PolygonPoint[], 
    index: number, 
    newLength: number
  ): PolygonPoint[] => {
    const point1 = points[index];
    const point2 = points[(index + 1) % points.length];
    
    // Calculate current length
    const currentLength = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(point1.lat, point1.lng),
      new google.maps.LatLng(point2.lat, point2.lng)
    );
    
    // Calculate scale factor
    const scale = newLength / currentLength;
    
    // Calculate vector from point1 to point2
    const dx = point2.lng - point1.lng;
    const dy = point2.lat - point1.lat;
    
    // Calculate new point2 position
    const newPoint2 = {
      lat: point1.lat + (dy * scale),
      lng: point1.lng + (dx * scale)
    };
    
    // Create new points array with adjusted point
    const newPoints = [...points];
    newPoints[(index + 1) % points.length] = newPoint2;
    
    return newPoints;
  }, []);

  // Add handler for length change
  const handleLengthChange = useCallback((newLength: number) => {
    if (!editingMeasurement) return;

    const { fieldId, index } = editingMeasurement;

    if (fieldId) {
      // Update completed field
      setFields(prevFields => 
        prevFields.map(field => {
          if (field.id === fieldId) {
            const newPoints = adjustLineLength(field.points, index, newLength);
            const newArea = calculateArea(newPoints);
            const { totalDistance, lineMeasurements } = calculatePerimeter(newPoints);
            return {
              ...field,
              points: newPoints,
              area: newArea,
              perimeter: totalDistance,
              measurements: lineMeasurements
            };
          }
          return field;
        })
      );
    } else {
      // Update current field
      if (currentField) {
        const newPoints = adjustLineLength(currentField.points, index, newLength);
        const newArea = calculateArea(newPoints);
        const { totalDistance, lineMeasurements } = calculatePerimeter(newPoints);
        setCurrentField({
          ...currentField,
          points: newPoints,
          area: newArea,
          perimeter: totalDistance,
          measurements: lineMeasurements
        });
      }
    }

    setEditingMeasurement(null);
  }, [editingMeasurement, currentField, adjustLineLength, calculateArea, calculatePerimeter]);

  // Client-side effect
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div>Loading map...</div>
      </div>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
      libraries={libraries}
    >
      <div className="flex flex-col h-screen w-full">
        <Navbar onPlaceSelect={handlePlaceSelect} />
        <div style={mapStyles.container}>
          <GoogleMap
            mapContainerStyle={mapStyles.map}
            center={defaultCenter}
            zoom={15}
            onLoad={onLoad}
            onUnmount={onUnmount}
            onClick={handleMapClick}
            options={mapOptions}
          >
            {/* Render all completed fields with measurements */}
            {fields.map((field) => (
              <React.Fragment key={field.id}>
                {!isMovingPoint || selectedFieldId !== field.id ? (
                  // Show original polygon when not moving or when another field is being edited
                  <Polygon
                    paths={field.points}
                    options={{
                      fillColor: '#00ff00',
                      fillOpacity: 0.3,
                      strokeColor: '#00ff00',
                      strokeWeight: 2,
                      editable: !isDrawing,
                      draggable: !isDrawing,
                    }}
                  />
                ) : (
                  // Show temporary polygon while moving
                  <Polygon
                    paths={tempPoints}
                    options={{
                      fillColor: '#00ff00',
                      fillOpacity: 0.3,
                      strokeColor: '#00ff00',
                      strokeWeight: 2,
                      editable: false,
                      draggable: false,
                    }}
                  />
                )}
                {/* Add measurement labels for each line */}
                {(isMovingPoint && selectedFieldId === field.id ? tempPoints : field.points).map((point, index) => {
                  const points = isMovingPoint && selectedFieldId === field.id ? tempPoints : field.points;
                  const nextPoint = points[(index + 1) % points.length];
                  const midpoint = calculateMidpoint(point, nextPoint);
                  const length = field.measurements[index]?.length || 0;
                  const isEditing = editingMeasurement?.fieldId === field.id && editingMeasurement?.index === index;
                  
                  return (
                    <MeasurementLabel
                      key={`measurement-${field.id}-${index}`}
                      position={midpoint}
                      text={formatLength(length)}
                      isEditing={isEditing}
                      onEditStart={() => setEditingMeasurement({ fieldId: field.id, index })}
                      onLengthChange={handleLengthChange}
                      onCancel={() => setEditingMeasurement(null)}
                    />
                  );
                })}
              </React.Fragment>
            ))}

            {/* Render current field with measurements */}
            {currentField && currentField.points.length >= 3 && (
              <React.Fragment>
                {!isMovingPoint || selectedFieldId !== null ? (
                  // Show original polygon when not moving or when a completed field is being edited
                  <Polygon
                    paths={currentField.points}
                    options={{
                      fillColor: '#00ff00',
                      fillOpacity: 0.3,
                      strokeColor: '#00ff00',
                      strokeWeight: 2,
                      editable: !isDrawing,
                      draggable: !isDrawing,
                    }}
                  />
                ) : (
                  // Show temporary polygon while moving
                  <Polygon
                    paths={tempPoints}
                    options={{
                      fillColor: '#00ff00',
                      fillOpacity: 0.3,
                      strokeColor: '#00ff00',
                      strokeWeight: 2,
                      editable: false,
                      draggable: false,
                    }}
                  />
                )}
                {/* Add measurement labels for each line */}
                {(isMovingPoint && selectedFieldId === null ? tempPoints : currentField.points).map((point, index) => {
                  const points = isMovingPoint && selectedFieldId === null ? tempPoints : currentField.points;
                  const nextPoint = points[(index + 1) % points.length];
                  const midpoint = calculateMidpoint(point, nextPoint);
                  const length = currentField.measurements[index]?.length || 0;
                  const isEditing = editingMeasurement?.fieldId === null && editingMeasurement?.index === index;
                  
                  return (
                    <MeasurementLabel
                      key={`measurement-current-${index}`}
                      position={midpoint}
                      text={formatLength(length)}
                      isEditing={isEditing}
                      onEditStart={() => setEditingMeasurement({ fieldId: null, index })}
                      onLengthChange={handleLengthChange}
                      onCancel={() => setEditingMeasurement(null)}
                    />
                  );
                })}
              </React.Fragment>
            )}

            {/* Render markers and labels for all fields */}
            {fields.map((field) => (
              field.points.map((point, index) => (
                <React.Fragment key={`${field.id}-${index}`}>
                  <Marker
                    position={isMovingPoint && selectedFieldId === field.id ? tempPoints[index] : point}
                    draggable={!isDrawing}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: (selectedPoint === index && selectedFieldId === field.id) ? '#FF0000' : 
                                hoveredPoint === index ? '#FFFFFF' : '#00ff00',
                      fillOpacity: 1,
                      strokeWeight: 2,
                      strokeColor: '#000000',
                    }}
                    onClick={(e) => {
                      e.domEvent.stopPropagation();
                      handleMarkerClick(index, field.id);
                    }}
                    onMouseOver={(e) => {
                      e.domEvent.stopPropagation();
                      handleMarkerMouseEnter(index);
                    }}
                    onMouseOut={handleMarkerMouseLeave}
                    onDragStart={(e) => handleMarkerDragStart(e, field.id)}
                    onDragEnd={() => handleMarkerDragEnd(field.id)}
                    onDrag={(e) => {
                      e.domEvent.stopPropagation();
                      if (e.latLng) {
                        handleMarkerDrag(index, e.latLng);
                      }
                    }}
                    options={{
                      clickable: true,
                      draggable: !isDrawing
                    }}
                    cursor="move"
                  />
                  <CornerLabel
                    position={isMovingPoint && selectedFieldId === field.id ? tempPoints[index] : point}
                    text={String.fromCharCode(65 + index)}
                  />
                </React.Fragment>
              ))
            ))}

            {/* Render markers and labels for current field */}
            {currentField && currentField.points.map((point, index) => (
              <React.Fragment key={`current-${index}`}>
                <Marker
                  position={isMovingPoint && selectedFieldId === null ? tempPoints[index] : point}
                  draggable={!isDrawing}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: (selectedPoint === index && selectedFieldId === null) ? '#FF0000' : 
                              hoveredPoint === index ? '#FFFFFF' : '#00ff00',
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#000000',
                  }}
                  onClick={(e) => {
                    e.domEvent.stopPropagation();
                    handleMarkerClick(index, null);
                  }}
                  onMouseOver={(e) => {
                    e.domEvent.stopPropagation();
                    handleMarkerMouseEnter(index);
                  }}
                  onMouseOut={handleMarkerMouseLeave}
                  onDragStart={(e) => handleMarkerDragStart(e, null)}
                  onDragEnd={() => handleMarkerDragEnd(null)}
                  onDrag={(e) => {
                    e.domEvent.stopPropagation();
                    if (e.latLng) {
                      handleMarkerDrag(index, e.latLng);
                    }
                  }}
                  options={{
                    clickable: true,
                    draggable: !isDrawing
                  }}
                  cursor="move"
                />
                <CornerLabel
                  position={isMovingPoint && selectedFieldId === null ? tempPoints[index] : point}
                  text={String.fromCharCode(65 + index)}
                />
              </React.Fragment>
            ))}

            {/* Red marker for selected point */}
            {selectedPoint !== null && (
              <>
                {/* Red marker for completed fields */}
                {fields.map((field) => (
                  selectedFieldId === field.id && (
                    <Marker
                      key={`red-${field.id}-${selectedPoint}`}
                      position={isMovingPoint ? tempPoints[selectedPoint] : field.points[selectedPoint]}
                      draggable={true}
                      icon={{
                        path: MARKER_PATH,
                        fillColor: '#FF0000',
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: '#000000',
                        scale: 1.5,
                        anchor: new google.maps.Point(0, 0),
                      }}
                      onDragStart={(e) => {
                        e.domEvent.stopPropagation();
                        handleMarkerDragStart(e, field.id);
                      }}
                      onDragEnd={() => {
                        handleMarkerDragEnd(field.id);
                        setSelectedPoint(null);
                      }}
                      onDrag={(e) => {
                        e.domEvent.stopPropagation();
                        if (e.latLng) {
                          handleMarkerDrag(selectedPoint, e.latLng);
                        }
                      }}
                      zIndex={1000}
                      options={{
                        clickable: true
                      }}
                    />
                  )
                ))}

                {/* Red marker for current field */}
                {currentField && selectedFieldId === null && (
                  <Marker
                    key={`red-current-${selectedPoint}`}
                    position={isMovingPoint ? tempPoints[selectedPoint] : currentField.points[selectedPoint]}
                    draggable={true}
                    icon={{
                      path: MARKER_PATH,
                      fillColor: '#FF0000',
                      fillOpacity: 1,
                      strokeWeight: 1,
                      strokeColor: '#000000',
                      scale: 1.5,
                      anchor: new google.maps.Point(0, 0),
                    }}
                    onDragStart={(e) => {
                      e.domEvent.stopPropagation();
                      handleMarkerDragStart(e, null);
                    }}
                    onDragEnd={() => {
                      handleMarkerDragEnd(null);
                      setSelectedPoint(null);
                    }}
                    onDrag={(e) => {
                      e.domEvent.stopPropagation();
                      if (e.latLng) {
                        handleMarkerDrag(selectedPoint, e.latLng);
                      }
                    }}
                    zIndex={1000}
                    options={{
                      clickable: true
                    }}
                  />
                )}
              </>
            )}

            {/* Line for 2 points in current field */}
            {currentField && currentField.points.length === 2 && (
              <Polyline
                path={currentField.points}
                options={{
                  strokeColor: '#00ff00',
                  strokeWeight: 2,
                  strokeOpacity: 1,
                }}
              />
            )}

            {/* User location marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: '#4285F4',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 2,
                }}
                zIndex={1000}
              />
            )}

            {/* Location accuracy circle */}
            {userLocation && (
              <Circle
                center={userLocation}
                radius={20}
                options={{
                  fillColor: '#4285F4',
                  fillOpacity: 0.2,
                  strokeColor: '#4285F4',
                  strokeOpacity: 0.5,
                  strokeWeight: 1,
                }}
              />
            )}
          </GoogleMap>
        </div>

        <MapControls
          currentMapType={mapType}
          onMapTypeChange={setMapType}
          onLocationClick={handleLocationClick}
          onToggleFullscreen={handleToggleFullscreen}
          isLocating={isLocating}
        />

        <CreateMenu
          showMenu={showCreateMenu}
          onToggleMenu={() => setShowCreateMenu(!showCreateMenu)}
          onOptionSelect={handleCreateOption}
        />

        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />

        {area > 0 && (
          <FieldMeasurements
            area={area}
            perimeter={perimeter}
            measurements={measurements}
          />
        )}
      </div>
    </LoadScript>
  );
};

export default MapComponent; 