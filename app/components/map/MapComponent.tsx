'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { GoogleMap, Polygon, Polyline, Marker, Circle } from '@react-google-maps/api';
import Navbar from './Navbar';
import MapControls from './MapControls';
import CreateMenu from './CreateMenu';
import ZoomControls from './ZoomControls';
import FieldMeasurements from './FieldMeasurements';
import MeasurementLabel from './MeasurementLabel';
import CornerLabel from './CornerLabel';
import { useMapLogic } from './hooks/useMapLogic';
import { libraries, mapStyles, defaultCenter, defaultZoom, MARKER_PATH, MapComponentProps } from './types';
import LoadingState from './LoadingState';
import SaveDialog from './SaveDialog';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Add styles to document
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

const MapComponent = ({ onAreaUpdate }: MapComponentProps) => {
  const [isClient, setIsClient] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const {
    state,
    setters,
    calculations
  } = useMapLogic();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const searchParams = useSearchParams();
  const mapId = searchParams.get('mapId');

  // Map event handlers
  const onLoad = useCallback((map: google.maps.Map) => {
    console.log('Map loading...');
    setters.setMap(map);
    map.setOptions({
      zoom: defaultZoom,
      center: defaultCenter,
      mapTypeId: 'hybrid',
      gestureHandling: 'greedy',
      tilt: 0
    });
    setMapLoaded(true);
    console.log('Map loaded successfully');
  }, [setters]);

  const onUnmount = useCallback(() => {
    setters.setMap(null);
  }, [setters]);

  // Map click handler
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!state.isDrawing || !e.latLng) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    if (!state.currentField) {
      // Create new field if none exists
      const newField = {
        id: Date.now().toString(),
        points: [newPoint],
        area: 0,
        perimeter: 0,
        measurements: []
      };
      setters.setCurrentField(newField);
    } else {
      // Add point to current field
      setters.setCurrentField(prev => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, newPoint]
        };
      });
    }
  }, [state.isDrawing, state.currentField, setters]);

  // Use useEffect to handle area and perimeter updates
  useEffect(() => {
    if (state.currentField && state.currentField.points.length >= 3) {
      const newArea = calculations.calculateArea(state.currentField.points);
      const { totalDistance, lineMeasurements } = calculations.calculatePerimeter(state.currentField.points);
      
      // Only update if values have changed
      if (
        newArea !== state.currentField.area ||
        totalDistance !== state.currentField.perimeter ||
        JSON.stringify(lineMeasurements) !== JSON.stringify(state.currentField.measurements)
      ) {
        const updatedField = {
          ...state.currentField,
          area: newArea,
          perimeter: totalDistance,
          measurements: lineMeasurements
        };
        
        setters.setCurrentField(updatedField);
        setters.setArea(newArea);
        setters.setPerimeter(totalDistance);
        setters.setMeasurements(lineMeasurements);

        if (onAreaUpdate) {
          onAreaUpdate(newArea);
        }
      }
    }
  }, [state.currentField?.points, calculations, onAreaUpdate]);

  // Map controls handlers
  const handleToggleMapType = useCallback(() => {
    setters.setMapType(prev => {
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
  }, [setters]);

  const handleLocationClick = useCallback(() => {
    setters.setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setters.setUserLocation(newLocation);
          if (state.map) {
            state.map.panTo(newLocation);
            state.map.setZoom(18);
          }
          setters.setIsLocating(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setters.setIsLocating(false);
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
      setters.setIsLocating(false);
    }
  }, [state.map, setters]);

  const handleToggleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (!state.isFullscreen) {
      elem.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setters.setIsFullscreen(!state.isFullscreen);
  }, [state.isFullscreen, setters]);

  const handleZoomIn = useCallback(() => {
    if (state.map) {
      state.map.setZoom((state.map.getZoom() || 15) + 1);
    }
  }, [state.map]);

  const handleZoomOut = useCallback(() => {
    if (state.map) {
      state.map.setZoom((state.map.getZoom() || 15) - 1);
    }
  }, [state.map]);

  // Create menu handlers
  const handleCreateOption = useCallback((option: 'import' | 'field' | 'distance' | 'marker') => {
    setters.setShowCreateMenu(false);
    if (option === 'field') {
      // If there's a current field, add it to fields array
      if (state.currentField) {
        const { totalDistance, lineMeasurements } = calculations.calculatePerimeter(state.currentField.points);
        const finalField = {
          ...state.currentField,
          perimeter: totalDistance,
          measurements: lineMeasurements
        };
        setters.setFields(prev => [...prev, finalField]);
      }
      // Create new empty field
      setters.setCurrentField({
        id: Date.now().toString(),
        points: [],
        area: 0,
        perimeter: 0,
        measurements: []
      });
      setters.setIsDrawing(true);
    }
  }, [state.currentField, calculations, setters]);

  // Marker handlers
  const handleMarkerClick = useCallback((index: number, fieldId: string | null) => {
    setters.setSelectedPoint(index);
    setters.setSelectedFieldId(fieldId);
    const points = fieldId ? state.fields.find(f => f.id === fieldId)?.points : state.currentField?.points;
    if (points) {
      setters.handleMovementStart(index, fieldId, points);
    }
  }, [state.fields, state.currentField, setters]);

  const handleMarkerDragStart = useCallback((e: google.maps.MapMouseEvent, index: number, fieldId: string | null) => {
    e.domEvent.stopPropagation();
    const points = fieldId ? state.fields.find(f => f.id === fieldId)?.points : state.currentField?.points;
    if (points) {
      setters.handleMovementStart(index, fieldId, points);
    }
    if (state.map) {
      state.map.setOptions({ 
        draggable: false,
        scrollwheel: false,
        gestureHandling: 'none'
      });
    }
  }, [state.map, state.fields, state.currentField, setters]);

  const handleMarkerDrag = useCallback((e: google.maps.MapMouseEvent, index?: number, fieldId?: string | null) => {
    if (e.latLng) {
      setters.handleMarkerDrag(e, index ?? state.selectedPoint ?? 0, fieldId ?? state.selectedFieldId);
    }
  }, [setters, state.selectedPoint, state.selectedFieldId]);

  // Add handler for search location select
  const handlePlaceSelect = useCallback((location: google.maps.LatLng) => {
    if (state.map) {
      state.map.panTo(location);
      state.map.setZoom(18);
    }
  }, [state.map]);

  // Handle length change
  const handleLengthChange = useCallback((newLength: number) => {
    if (!state.editingMeasurement) return;

    const { fieldId, index } = state.editingMeasurement;

    if (fieldId) {
      // Update completed field
      setters.setFields(prevFields => 
        prevFields.map(field => {
          if (field.id === fieldId) {
            const newPoints = calculations.adjustLineLength(field.points, index, newLength);
            const newArea = calculations.calculateArea(newPoints);
            const { totalDistance, lineMeasurements } = calculations.calculatePerimeter(newPoints);
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
      if (state.currentField) {
        const newPoints = calculations.adjustLineLength(state.currentField.points, index, newLength);
        const newArea = calculations.calculateArea(newPoints);
        const { totalDistance, lineMeasurements } = calculations.calculatePerimeter(newPoints);
        setters.setCurrentField({
          ...state.currentField,
          points: newPoints,
          area: newArea,
          perimeter: totalDistance,
          measurements: lineMeasurements
        });
      }
    }

    setters.setEditingMeasurement(null);
  }, [state.editingMeasurement, state.currentField, calculations, setters]);

  // Add handler for midpoint drag
  const handleMidpointDrag = useCallback((e: google.maps.MapMouseEvent, index: number, fieldId: string | null) => {
    if (!e.latLng) return;
    
    const points = fieldId ? 
      state.fields.find(f => f.id === fieldId)?.points : 
      state.currentField?.points;

    if (!points) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };

    if (fieldId) {
      setters.setFields(prev => prev.map(field => {
        if (field.id === fieldId) {
          const newPoints = [...field.points];
          newPoints.splice(index + 1, 0, newPoint);
          return {
            ...field,
            points: newPoints
          };
        }
        return field;
      }));
    } else if (state.currentField) {
      const newPoints = [...state.currentField.points];
      newPoints.splice(index + 1, 0, newPoint);
      setters.setCurrentField({
        ...state.currentField,
        points: newPoints
      });
    }
  }, [state.fields, state.currentField, setters]);

  // Client-side effect
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load saved map if mapId is present
  useEffect(() => {
    if (mapId) {
      const savedMaps = localStorage.getItem('savedMaps');
      if (savedMaps) {
        const maps = JSON.parse(savedMaps);
        const map = maps.find((m: any) => m.id === mapId);
        if (map) {
          setters.setFields([map.field]);
        }
      }
    }
  }, [mapId]);

  const handleSave = (data: { name: string; description: string; group: string }) => {
    const savedMap = {
      id: Date.now().toString(),
      name: data.name,
      description: data.description,
      group: data.group,
      field: state.currentField || state.fields[0],
      createdAt: new Date().toISOString()
    };

    const existingMaps = localStorage.getItem('savedMaps');
    const maps = existingMaps ? JSON.parse(existingMaps) : [];
    maps.push(savedMap);
    localStorage.setItem('savedMaps', JSON.stringify(maps));

    setShowSaveDialog(false);
  };

  // Create marker icons
  const getRegularMarkerIcon = (isHovered: boolean) => ({
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: isHovered ? '#FFFFFF' : '#4A90E2',
    fillOpacity: 1,
    strokeColor: '#4A90E2',
    strokeWeight: 2
  });

  const getSelectedMarkerIcon = () => ({
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#FF0000',
    fillOpacity: 1,
    strokeColor: '#FF0000',
    strokeWeight: 2
  });

  if (!isClient) {
    return <LoadingState />;
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <Navbar onPlaceSelect={handlePlaceSelect} />
      <div className="relative flex-1">
        <GoogleMap
          mapContainerStyle={mapStyles.map}
          center={defaultCenter}
          zoom={defaultZoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          options={{
            mapTypeId: state.mapType,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: false,
            scaleControl: true,
            rotateControl: false,
            panControl: false,
            scrollwheel: !state.isMovingPoint,
            clickableIcons: false,
            disableDefaultUI: true,
            tilt: 0,
            gestureHandling: 'greedy',
            draggableCursor: state.isDrawing ? 'crosshair' : 'grab',
            draggingCursor: 'move',
            draggable: !state.isMovingPoint,
            minZoom: 3,
            maxZoom: 20
          }}
        >
          {/* Render all completed fields with measurements */}
          {state.fields.map((field) => (
            <React.Fragment key={field.id}>
              {/* Always show the polygon */}
              <Polygon
                paths={state.isMovingPoint && state.selectedFieldId === field.id ? state.tempPoints : field.points}
                options={{
                  fillColor: '#00ff00',
                  fillOpacity: 0.3,
                  strokeColor: '#00ff00',
                  strokeWeight: 2,
                  editable: false,
                  draggable: false,
                  clickable: true,
                  zIndex: 1
                }}
              />

              {/* Add measurement labels for each line */}
              {(state.isMovingPoint && state.selectedFieldId === field.id ? state.tempPoints : field.points).map((point, index, points) => {
                const nextPoint = points[(index + 1) % points.length];
                const midpoint = calculations.calculateMidpoint(point, nextPoint);
                const length = field.measurements[index]?.length || 0;
                const isEditing = state.editingMeasurement?.fieldId === field.id && state.editingMeasurement?.index === index;
                
                return (
                  <MeasurementLabel
                    key={`measurement-${field.id}-${index}`}
                    position={midpoint}
                    text={calculations.formatLength(length)}
                    isEditing={isEditing}
                    onEditStart={() => setters.setEditingMeasurement({ fieldId: field.id, index })}
                    onLengthChange={handleLengthChange}
                    onCancel={() => setters.setEditingMeasurement(null)}
                  />
                );
              })}

              {/* Add corner labels and markers */}
              {(state.isMovingPoint && state.selectedFieldId === field.id ? state.tempPoints : field.points).map((point, index, points) => {
                const nextPoint = points[(index + 1) % points.length];
                const midpoint = calculations.calculateMidpoint(point, nextPoint);
                
                return (
                  <React.Fragment key={`${field.id}-${index}`}>
                    {/* Regular marker */}
                    {!(state.selectedPoint === index && state.selectedFieldId === field.id) && (
                      <Marker
                        position={point}
                        draggable={true}
                        icon={getRegularMarkerIcon(state.hoveredPoint === index)}
                        onClick={(e) => {
                          e.domEvent.stopPropagation();
                          handleMarkerClick(index, field.id);
                        }}
                        onMouseOver={() => setters.handleMarkerHover(index)}
                        onMouseOut={() => setters.handleMarkerHover(null)}
                        onDragStart={(e) => handleMarkerDragStart(e, index, field.id)}
                        onDrag={(e) => {
                          if (!e.latLng) return;
                          handleMarkerDrag(e, index, field.id);
                        }}
                        onDragEnd={(e) => {
                          setters.handleMovementEnd();
                          // Update the final position
                          if (e.latLng) {
                            const finalPoint = {
                              lat: e.latLng.lat(),
                              lng: e.latLng.lng()
                            };
                            setters.handleMarkerDrag(e, index, field.id);
                          }
                        }}
                        options={{
                          clickable: true,
                          draggable: true
                        }}
                        cursor="move"
                        zIndex={2}
                      />
                    )}
                    
                    {/* Selected marker */}
                    {(state.selectedPoint === index && state.selectedFieldId === field.id) && (
                      <Marker
                        position={point}
                        draggable={true}
                        icon={getSelectedMarkerIcon()}
                        onDragStart={(e) => handleMarkerDragStart(e, index, field.id)}
                        onDrag={(e) => {
                          if (!e.latLng) return;
                          handleMarkerDrag(e, index, field.id);
                        }}
                        onDragEnd={(e) => {
                          setters.handleMovementEnd();
                          // Update the final position
                          if (e.latLng) {
                            const finalPoint = {
                              lat: e.latLng.lat(),
                              lng: e.latLng.lng()
                            };
                            setters.handleMarkerDrag(e, index, field.id);
                          }
                        }}
                        options={{
                          clickable: true,
                          draggable: true
                        }}
                        cursor="move"
                        zIndex={3}
                      />
                    )}

                    {/* Add midpoint marker */}
                    {index < points.length - 1 && (
                      <Marker
                        position={midpoint}
                        draggable={true}
                        icon={{
                          path: mapLoaded ? google.maps.SymbolPath.CIRCLE : 0,
                          scale: 6,
                          fillColor: state.hoveredPoint === `mid-${index}` ? '#FFFFFF' : '#FFA500',
                          fillOpacity: 1,
                          strokeWeight: 2,
                          strokeColor: '#000000',
                        }}
                        onClick={(e) => {
                          e.domEvent.stopPropagation();
                          const newPoints = [...points];
                          newPoints.splice(index + 1, 0, midpoint);
                          
                          if (field.id) {
                            setters.setFields(prev => prev.map(f => {
                              if (f.id === field.id) {
                                return {
                                  ...f,
                                  points: newPoints
                                };
                              }
                              return f;
                            }));
                            
                            // Select the newly created point
                            setters.setSelectedPoint(index + 1);
                            setters.setSelectedFieldId(field.id);
                            setters.handleMovementStart(index + 1, field.id, newPoints);
                          }
                        }}
                        onDragStart={(e) => {
                          e.domEvent.stopPropagation();
                          if (!e.latLng) return;
                          
                          const newPoint = {
                            lat: e.latLng.lat(),
                            lng: e.latLng.lng()
                          };
                          const newPoints = [...points];
                          newPoints.splice(index + 1, 0, newPoint);
                          
                          if (field.id) {
                            setters.setFields(prev => prev.map(f => {
                              if (f.id === field.id) {
                                return {
                                  ...f,
                                  points: newPoints
                                };
                              }
                              return f;
                            }));
                            
                            // Select the newly created point
                            setters.setSelectedPoint(index + 1);
                            setters.setSelectedFieldId(field.id);
                            setters.handleMovementStart(index + 1, field.id, newPoints);
                          }
                        }}
                        onDrag={(e) => {
                          if (!e.latLng) return;
                          if (state.selectedPoint !== null) {
                            setters.handleMarkerDrag(e, state.selectedPoint, field.id);
                          }
                        }}
                        onDragEnd={() => {
                          if (state.isMovingPoint) {
                            setters.handleMovementEnd();
                          }
                        }}
                        onMouseOver={() => setters.handleMarkerHover(`mid-${index}`)}
                        onMouseOut={() => setters.handleMarkerHover(null)}
                        options={{
                          clickable: true,
                          draggable: true,
                          zIndex: 2
                        }}
                        cursor="move"
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}

          {/* Render current field */}
          {state.currentField && (
            <React.Fragment>
              {state.currentField.points.length >= 3 && (
                <Polygon
                  paths={state.isMovingPoint && state.selectedFieldId === null ? state.tempPoints : state.currentField.points}
                  options={{
                    fillColor: '#00ff00',
                    fillOpacity: 0.3,
                    strokeColor: '#00ff00',
                    strokeWeight: 2,
                    editable: !state.isDrawing && !state.isMovingPoint,
                    draggable: !state.isDrawing && !state.isMovingPoint,
                    clickable: !state.isMovingPoint
                  }}
                />
              )}

              {/* Add measurement labels for current field */}
              {state.currentField?.points.length >= 2 && (
                (state.isMovingPoint && state.selectedFieldId === null ? state.tempPoints : state.currentField?.points)?.map((point, index) => {
                  if (!state.currentField) return null;
                  const points = state.currentField.points;
                  const nextPoint = points[(index + 1) % points.length];
                  const midpoint = calculations.calculateMidpoint(point, nextPoint);
                  const length = state.currentField?.measurements[index]?.length || 0;
                  const isEditing = state.editingMeasurement?.fieldId === null && state.editingMeasurement?.index === index;
                  
                  return (
                    <MeasurementLabel
                      key={`measurement-current-${index}`}
                      position={midpoint}
                      text={calculations.formatLength(length)}
                      isEditing={isEditing}
                      onEditStart={() => setters.setEditingMeasurement({ fieldId: null, index })}
                      onLengthChange={handleLengthChange}
                      onCancel={() => setters.setEditingMeasurement(null)}
                    />
                  );
                })
              )}

              {/* Add corner labels and markers for current field */}
              {state.currentField.points.map((point, index) => {
                if (!state.currentField) return null;
                const points = state.currentField.points;
                const nextPoint = points[(index + 1) % points.length];
                const midpoint = calculations.calculateMidpoint(point, nextPoint);

                return (
                  <React.Fragment key={`current-${index}`}>
                    {/* Regular marker */}
                    {!(state.selectedPoint === index && state.selectedFieldId === null) && (
                      <Marker
                        position={point}
                        draggable={true}
                        icon={getRegularMarkerIcon(state.hoveredPoint === index)}
                        onClick={(e) => {
                          e.domEvent.stopPropagation();
                          handleMarkerClick(index, null);
                        }}
                        onMouseOver={() => setters.handleMarkerHover(index)}
                        onMouseOut={() => setters.handleMarkerHover(null)}
                        options={{
                          clickable: true,
                          draggable: !state.isDrawing
                        }}
                        cursor="pointer"
                      />
                    )}

                    {/* Selected marker */}
                    {(state.selectedPoint === index && state.selectedFieldId === null) && (
                      <Marker
                        position={point}
                        draggable={true}
                        icon={getSelectedMarkerIcon()}
                        onDragStart={(e) => handleMarkerDragStart(e, index, null)}
                        onDragEnd={() => setters.handleMovementEnd()}
                        onDrag={(e) => {
                          if (!e.latLng) return;
                          const selectedPoint = state.selectedPoint;
                          if (typeof selectedPoint === 'number') {
                            handleMarkerDrag(e, selectedPoint, null);
                          }
                        }}
                        options={{
                          clickable: true,
                          draggable: true
                        }}
                        cursor="move"
                        zIndex={3}
                      />
                    )}

                    <CornerLabel
                      position={point}
                      text={String.fromCharCode(65 + index)}
                    />

                    {/* Add midpoint marker */}
                    {index < points.length - 1 && state.currentField && (
                      <Marker
                        position={midpoint}
                        draggable={true}
                        icon={{
                          path: mapLoaded ? google.maps.SymbolPath.CIRCLE : 0,
                          scale: 6,
                          fillColor: state.hoveredPoint === `mid-${index}` ? '#FFFFFF' : '#FFA500',
                          fillOpacity: 1,
                          strokeWeight: 2,
                          strokeColor: '#000000',
                        }}
                        onClick={(e) => {
                          e.domEvent.stopPropagation();
                          const newPoints = [...points];
                          newPoints.splice(index + 1, 0, midpoint);
                          
                          if (state.currentField) {
                            const newArea = calculations.calculateArea(newPoints);
                            const { totalDistance, lineMeasurements } = calculations.calculatePerimeter(newPoints);
                            setters.setCurrentField({
                              ...state.currentField,
                              id: state.currentField.id,
                              points: newPoints,
                              area: newArea,
                              perimeter: totalDistance,
                              measurements: lineMeasurements
                            });
                            
                            // Select the newly created point
                            setters.setSelectedPoint(index + 1);
                            setters.setSelectedFieldId(null);
                            setters.handleMovementStart(index + 1, null, newPoints);
                          }
                        }}
                        onDragStart={(e) => {
                          e.domEvent.stopPropagation();
                          if (!e.latLng) return;
                          
                          const newPoint = {
                            lat: e.latLng.lat(),
                            lng: e.latLng.lng()
                          };
                          const newPoints = [...points];
                          newPoints.splice(index + 1, 0, newPoint);
                          
                          if (state.currentField) {
                            setters.setCurrentField({
                              ...state.currentField,
                              id: state.currentField.id,
                              points: newPoints
                            });
                            
                            // Select the newly created point
                            setters.setSelectedPoint(index + 1);
                            setters.setSelectedFieldId(null);
                            setters.handleMovementStart(index + 1, null, newPoints);
                          }
                        }}
                        onDrag={(e) => {
                          if (!e.latLng) return;
                          if (state.selectedPoint !== null) {
                            setters.handleMarkerDrag(e, state.selectedPoint, null);
                          }
                        }}
                        onDragEnd={() => {
                          if (state.isMovingPoint) {
                            setters.handleMovementEnd();
                          }
                        }}
                        onMouseOver={() => setters.handleMarkerHover(`mid-${index}`)}
                        onMouseOut={() => setters.handleMarkerHover(null)}
                        options={{
                          clickable: true,
                          draggable: true,
                          zIndex: 2
                        }}
                        cursor="move"
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Line for 2 points in current field */}
              {state.currentField.points.length === 2 && (
                <Polyline
                  path={state.currentField.points}
                  options={{
                    strokeColor: '#00ff00',
                    strokeWeight: 2,
                    strokeOpacity: 1,
                  }}
                />
              )}
            </React.Fragment>
          )}

          {/* User location marker and accuracy circle */}
          {state.userLocation && mapLoaded && (
            <>
              <Marker
                position={state.userLocation}
                icon={getRegularMarkerIcon(false)}
                zIndex={1000}
              />
              <Circle
                center={state.userLocation}
                radius={20}
                options={{
                  fillColor: '#4285F4',
                  fillOpacity: 0.2,
                  strokeColor: '#4285F4',
                  strokeOpacity: 0.5,
                  strokeWeight: 1,
                }}
              />
            </>
          )}
        </GoogleMap>

        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={setters.undo}
            disabled={!state.canUndo}
            className={`p-2 rounded-lg shadow-lg transition-colors ${
              state.canUndo 
                ? 'bg-white hover:bg-gray-100 text-gray-800' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Undo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 0 1 4 4v2m-6-6l-4-4m4 4l-4 4" />
            </svg>
          </button>
          <button
            onClick={setters.redo}
            disabled={!state.canRedo}
            className={`p-2 rounded-lg shadow-lg transition-colors ${
              state.canRedo 
                ? 'bg-white hover:bg-gray-100 text-gray-800' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Redo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a4 4 0 0 0-4 4v2m6-6l4-4m-4 4l4 4" />
            </svg>
          </button>
          <Link
            href="/saved-maps"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-lg"
          >
            Saved Maps
          </Link>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-lg"
            disabled={!state.currentField && state.fields.length === 0}
          >
            Save Map
          </button>
        </div>

        {/* Add custom zoom controls */}
        <div className="absolute bottom-20 right-4  flex-col gap-2 hidden">
          <button
            onClick={() => state.map?.setZoom((state.map?.getZoom() || defaultZoom) + 1)}
            className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
            title="Zoom in"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button
            onClick={() => state.map?.setZoom((state.map?.getZoom() || defaultZoom) - 1)}
            className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
            title="Zoom out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>
      </div>

      <MapControls
        currentMapType={state.mapType}
        onMapTypeChange={setters.setMapType}
        onLocationClick={handleLocationClick}
        onToggleFullscreen={handleToggleFullscreen}
        onClearFields={setters.clearSavedFields}
        isLocating={state.isLocating}
      />

      <CreateMenu
        showMenu={state.showCreateMenu}
        onToggleMenu={() => setters.setShowCreateMenu(!state.showCreateMenu)}
        onOptionSelect={handleCreateOption}
      />

      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {state.area > 0 && (
        <FieldMeasurements
          area={state.area}
          perimeter={state.perimeter}
          measurements={state.measurements}
        />
      )}

      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
      />
    </div>
  );
};

export default MapComponent; 