import type { Libraries } from '@react-google-maps/api';

export interface PolygonPoint {
  lat: number;
  lng: number;
}

export interface Field {
  id: string;
  points: google.maps.LatLngLiteral[];
  area: number;
  perimeter: number;
  measurements: { length: number; width: number; }[];
}

export type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

export const libraries: Libraries = ['places', 'geometry', 'drawing'];

export const mapStyles = {
  container: {
    position: 'relative',
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
} as const;

export const defaultCenter = {
  lat: 28.6139,
  lng: 77.2090
};

export const defaultZoom = 15;

export interface MapComponentProps {
  onAreaUpdate: (area: number) => void;
}

// Define marker path as a string constant
export const MARKER_PATH = "M0-48c-9.8 0-17.7 7.8-17.7 17.4 0 15.5 17.7 30.6 17.7 30.6s17.7-15.4 17.7-30.6c0-9.6-7.9-17.4-17.7-17.4z"; 