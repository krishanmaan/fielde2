'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, LoadScript, Polygon, Polyline, Marker } from '@react-google-maps/api';
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

const MapComponent = ({ onAreaUpdate }: MapComponentProps) => {
  // All hooks need to be at the top level
  const [isClient, setIsClient] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<PolygonPoint[]>([]);
  const [area, setArea] = useState<number>(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [perimeter, setPerimeter] = useState<number>(0);
  const [measurements, setMeasurements] = useState<{ length: number; width: number; }[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [tempPoints, setTempPoints] = useState<PolygonPoint[]>([]);
  const [isMovingPoint, setIsMovingPoint] = useState(false);

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
  const calculatePerimeter = useCallback((polygonPoints: PolygonPoint[]) => {
    if (polygonPoints.length < 2) return 0;
    let totalDistance = 0;
    const measurements: { length: number; width: number; }[] = [];

    for (let i = 0; i < polygonPoints.length; i++) {
      const point1 = polygonPoints[i];
      const point2 = polygonPoints[(i + 1) % polygonPoints.length];
      
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(point1.lat, point1.lng),
        new google.maps.LatLng(point2.lat, point2.lng)
      );
      
      totalDistance += distance;
      measurements.push({ length: distance, width: 0 });
    }

    setMeasurements(measurements);
    return totalDistance;
  }, []);

  // Map click handler
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    setPoints(prevPoints => [...prevPoints, newPoint]);
  }, [isDrawing]);

  // Use useEffect to handle area and perimeter updates
  useEffect(() => {
    if (points.length >= 3) {
      const newArea = calculateArea(points);
      const newPerimeter = calculatePerimeter(points);
      setArea(newArea);
      setPerimeter(newPerimeter);
      if (onAreaUpdate) {
        onAreaUpdate(newArea);
      }
    }
  }, [points, calculateArea, calculatePerimeter, onAreaUpdate]);

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
    if (navigator.geolocation && map) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          map.setCenter(pos);
          map.setZoom(18);
        },
        () => {
          alert('Error: The Geolocation service failed.');
        }
      );
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
      setPoints([]);
      setArea(0);
      setIsDrawing(true);
    }
  }, []);

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
  const handleMarkerClick = useCallback((index: number) => {
    setSelectedPoint(index);
    setIsMovingMarker(true);
    setIsMovingPoint(true);
    // Store temporary points for preview
    setTempPoints([...points]);
    if (map) {
      map.setOptions({ 
        draggable: false,
        scrollwheel: false,
        gestureHandling: 'none'
      });
    }
  }, [map, points]);

  // Add marker hover handlers
  const handleMarkerMouseEnter = (index: number) => {
    setHoveredPoint(index);
  };

  const handleMarkerMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Add marker movement handlers
  const handleMarkerDragStart = useCallback((e: google.maps.MapMouseEvent) => {
    e.domEvent.stopPropagation();
    setIsMovingMarker(true);
    setIsMovingPoint(true);
    setTempPoints([...points]);
    if (map) {
      map.setOptions({ 
        draggable: false,
        scrollwheel: false,
        gestureHandling: 'none'
      });
    }
  }, [map, points]);

  const handleMarkerDragEnd = useCallback(() => {
    setIsMovingMarker(false);
    setIsMovingPoint(false);
    setPoints(tempPoints);
    if (map) {
      map.setOptions({ 
        draggable: true,
        scrollwheel: true,
        gestureHandling: 'cooperative'
      });
    }
  }, [map, tempPoints]);

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
            {/* Only show the main polygon when not moving */}
            {points.length >= 3 && !isMovingPoint && (
              <Polygon
                paths={points}
                options={{
                  fillColor: '#00ff00',
                  fillOpacity: 0.3,
                  strokeColor: '#00ff00',
                  strokeWeight: 2,
                  editable: !isDrawing,
                  draggable: !isDrawing,
                }}
              />
            )}

            {/* Show temporary polygon while moving */}
            {tempPoints.length >= 3 && isMovingPoint && (
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

            {/* Use temp points for markers when moving */}
            {(isMovingPoint ? tempPoints : points).map((point, index) => (
              <Marker
                key={index}
                position={point}
                draggable={!isDrawing}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: selectedPoint === index ? '#FF0000' : 
                            hoveredPoint === index ? '#FFFFFF' : '#00FF00',
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: '#000000',
                }}
                onClick={(e) => {
                  e.domEvent.stopPropagation();
                  handleMarkerClick(index);
                }}
                onMouseOver={(e) => {
                  e.domEvent.stopPropagation();
                  handleMarkerMouseEnter(index);
                }}
                onMouseOut={handleMarkerMouseLeave}
                onDragStart={handleMarkerDragStart}
                onDragEnd={handleMarkerDragEnd}
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
            ))}

            {/* Red marker using temp points when moving */}
            {selectedPoint !== null && (isMovingPoint ? tempPoints : points)[selectedPoint] && (
              <Marker
                position={(isMovingPoint ? tempPoints : points)[selectedPoint]}
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
                onDragStart={handleMarkerDragStart}
                onDragEnd={handleMarkerDragEnd}
                onDrag={(e) => {
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

            {/* Line for 2 points */}
            {points.length === 2 && (
              <Polyline
                path={points}
                options={{
                  strokeColor: '#00ff00',
                  strokeWeight: 2,
                  strokeOpacity: 1,
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