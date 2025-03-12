'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, LoadScript, Polygon, Polyline } from '@react-google-maps/api';
import Navbar from './Navbar';
import MapControls from './MapControls';
import CreateMenu from './CreateMenu';
import ZoomControls from './ZoomControls';
import AreaDisplay from './AreaDisplay';

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
  lat: 20.5937,
  lng: 78.9629
};

interface MapComponentProps {
  onAreaUpdate?: (area: number) => void;
}

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

  // Map click handler
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    setPoints(currentPoints => {
      const newPoints = [...currentPoints, newPoint];
      if (newPoints.length >= 3) {
        const newArea = calculateArea(newPoints);
        setArea(newArea);
        onAreaUpdate?.(newArea);
      }
      return newPoints;
    });
  }, [isDrawing, calculateArea, onAreaUpdate]);

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
    <div className="flex flex-col h-screen w-full">
      <Navbar />
      
      <div style={mapStyles.container}>
        <LoadScript
          googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
          libraries={libraries}
          loadingElement={
            <div className="w-full h-full flex items-center justify-center">
              <div>Loading Google Maps...</div>
            </div>
          }
        >
          <GoogleMap
            mapContainerStyle={mapStyles.map}
            center={defaultCenter}
            zoom={15}
            onLoad={onLoad}
            onUnmount={onUnmount}
            onClick={handleMapClick}
            options={{
              mapTypeId: mapType,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              zoomControl: false,
              scaleControl: true,
              rotateControl: false,
              panControl: false,
              scrollwheel: true,
              clickableIcons: false,
              disableDefaultUI: true,
              tilt: 0,
              gestureHandling: 'greedy'
            }}
          >
            {points.length >= 3 && (
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
        </LoadScript>

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

        <AreaDisplay area={area} />
      </div>
    </div>
  );
};

export default MapComponent; 