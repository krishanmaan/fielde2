import { useState, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Polygon, Marker, Polyline } from '@react-google-maps/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBars,
  faFilter,
  faSquareCheck, 
  faMagnifyingGlass,
  faLayerGroup,
  faLocationCrosshairs,
  faExpand,
  faDownload,
  faDrawPolygon,
  faRuler,
  faMapMarker,
  faPlus,
  faMinus
} from '@fortawesome/free-solid-svg-icons';

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

// Center on India by default
const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629
};

interface PolygonPoint {
  lat: number;
  lng: number;
}

export const PolygonDrawingTool: React.FC = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<PolygonPoint[]>([]);
  const [area, setArea] = useState<number>(0);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [mapType, setMapType] = useState<'hybrid' | 'satellite'>('hybrid');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calculate area of polygon in hectares
  const calculateArea = (polygonPoints: PolygonPoint[]) => {
    if (polygonPoints.length < 3) return 0;
    
    const polygon = new google.maps.Polygon({ paths: polygonPoints });
    const areaInSqMeters = google.maps.geometry.spherical.computeArea(polygon.getPath());
    return areaInSqMeters / 10000; // Convert to hectares
  };

  // Handle map click for drawing
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
      setArea(newArea);
    }
  }, [isDrawing, points]);

  // Toggle drawing mode
  const toggleDrawing = () => {
    if (isDrawing) {
      // Finish drawing
      setIsDrawing(false);
    } else {
      // Start drawing
      setPoints([]);
      setArea(0);
      setIsDrawing(true);
    }
  };

  // Clear polygon
  const clearPolygon = () => {
    setPoints([]);
    setArea(0);
    setIsDrawing(false);
  };

  // Handle polygon load
  const onPolygonLoad = useCallback((polygon: google.maps.Polygon) => {
    polygonRef.current = polygon;
    
    // Add path change listener
    const path = polygon.getPath();
    
    // Clear previous listeners
    listenersRef.current.forEach(listener => {
      google.maps.event.removeListener(listener);
    });
    
    // Add new listeners
    listenersRef.current = [
      google.maps.event.addListener(path, 'set_at', () => {
        const newPoints = getPathPoints(path);
        setPoints(newPoints);
        
        if (newPoints.length >= 3) {
          const newArea = calculateArea(newPoints);
          setArea(newArea);
        }
      }),
      google.maps.event.addListener(path, 'insert_at', () => {
        const newPoints = getPathPoints(path);
        setPoints(newPoints);
        
        if (newPoints.length >= 3) {
          const newArea = calculateArea(newPoints);
          setArea(newArea);
        }
      }),
      google.maps.event.addListener(path, 'remove_at', () => {
        const newPoints = getPathPoints(path);
        setPoints(newPoints);
        
        if (newPoints.length >= 3) {
          const newArea = calculateArea(newPoints);
          setArea(newArea);
        }
      })
    ];
  }, []);

  // Get points from path
  const getPathPoints = (path: google.maps.MVCArray<google.maps.LatLng>): PolygonPoint[] => {
    const points: PolygonPoint[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      points.push({
        lat: point.lat(),
        lng: point.lng()
      });
    }
    return points;
  };

  // Handle layer change
  const toggleMapType = () => {
    setMapType(prev => prev === 'hybrid' ? 'satellite' : 'hybrid');
  };

  // Handle location button click
  const handleLocationClick = () => {
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
    } else {
      alert('Error: Your browser doesn\'t support geolocation.');
    }
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    const elem = document.documentElement;
    if (!isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // Handle zoom controls
  const handleZoomIn = () => {
    if (map) {
      map.setZoom((map.getZoom() || 15) + 1);
    }
  };

  const handleZoomOut = () => {
    if (map) {
      map.setZoom((map.getZoom() || 15) - 1);
    }
  };

  // Handle create menu options
  const handleCreateOption = (option: 'import' | 'field' | 'distance' | 'marker') => {
    setShowCreateMenu(false);
    switch (option) {
      case 'import':
        // Handle import
        console.log('Import clicked');
        break;
      case 'field':
        // Start drawing polygon
        setPoints([]);
        setArea(0);
        setIsDrawing(true);
        break;
      case 'distance':
        // Handle distance measurement
        console.log('Distance clicked');
        break;
      case 'marker':
        // Handle marker placement
        console.log('Marker clicked');
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Navbar - Golden gradient background */}
      <div className="bg-gradient-to-r from-[#DAA520] to-[#B8860B] text-white px-4 py-2 flex items-center justify-between h-12 shadow-md">
        <div className="flex items-center gap-4">
          <button className="hover:bg-white/20 p-2 rounded transition-colors">
            <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold tracking-wide">Map</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="hover:bg-white/20 p-2 rounded transition-colors">
            <FontAwesomeIcon icon={faFilter} className="h-5 w-5" />
          </button>
          <button className="hover:bg-white/20 p-2 rounded transition-colors">
            <FontAwesomeIcon icon={faSquareCheck} className="h-5 w-5" />
          </button>
          <button className="hover:bg-white/20 p-2 rounded transition-colors">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div style={mapStyles.container}>
        <LoadScript
          googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
          libraries={libraries}
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
            {/* Polygon */}
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
                onLoad={onPolygonLoad}
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
        </LoadScript>

        {/* Map Controls - Moved to left side */}
        <div className="absolute left-3 top-16 flex flex-col gap-2">
          <button 
            onClick={toggleMapType}
            className="bg-black bg-opacity-60 w-12 h-12 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition-colors"
          >
            <FontAwesomeIcon icon={faLayerGroup} className="h-5 w-5 text-white" />
          </button>
          <button 
            onClick={handleLocationClick}
            className="bg-[#FF4C4C] w-12 h-12 rounded-lg flex items-center justify-center hover:bg-[#FF3C3C] transition-colors"
          >
            <FontAwesomeIcon icon={faLocationCrosshairs} className="h-5 w-5 text-white" />
          </button>
          <button 
            onClick={toggleFullscreen}
            className="bg-black bg-opacity-60 w-12 h-12 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition-colors"
          >
            <FontAwesomeIcon icon={faExpand} className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Create Menu - Bottom center */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="relative">
            {showCreateMenu && (
              <div className="absolute bottom-full left-0 mb-3 bg-black bg-opacity-75 rounded-lg overflow-hidden w-48">
                <button 
                  onClick={() => handleCreateOption('import')}
                  className="w-full text-white p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors"
                >
                  <FontAwesomeIcon icon={faDownload} className="h-5 w-5" />
                  <span>Import</span>
                </button>
                <button 
                  onClick={() => handleCreateOption('field')}
                  className="w-full text-white p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors"
                >
                  <FontAwesomeIcon icon={faDrawPolygon} className="h-5 w-5" />
                  <span>Field</span>
                </button>
                <button 
                  onClick={() => handleCreateOption('distance')}
                  className="w-full text-white p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors"
                >
                  <FontAwesomeIcon icon={faRuler} className="h-5 w-5" />
                  <span>Distance</span>
                </button>
                <button 
                  onClick={() => handleCreateOption('marker')}
                  className="w-full text-white p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors"
                >
                  <FontAwesomeIcon icon={faMapMarker} className="h-5 w-5" />
                  <span>Marker</span>
                </button>
              </div>
            )}

            <button 
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-opacity-80 transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} className="h-5 w-5" />
              <span>Create new</span>
            </button>
          </div>
        </div>

        {/* Zoom Controls - Bottom left */}
        <div className="absolute bottom-8 left-3 bg-black bg-opacity-60 rounded-lg">
          <button 
            onClick={handleZoomIn}
            className="w-12 h-12 text-white border-b border-gray-700 flex items-center justify-center hover:bg-opacity-80 transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} className="h-5 w-5" />
          </button>
          <button 
            onClick={handleZoomOut}
            className="w-12 h-12 text-white flex items-center justify-center hover:bg-opacity-80 transition-colors"
          >
            <FontAwesomeIcon icon={faMinus} className="h-5 w-5" />
          </button>
        </div>

        {/* Area Display */}
        {area > 0 && (
          <div className="absolute top-3 left-3 z-50 bg-black bg-opacity-70 text-white p-3 rounded-lg shadow-lg">
            <div className="text-sm font-medium">Area: {area.toFixed(2)} hectares</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PolygonDrawingTool; 