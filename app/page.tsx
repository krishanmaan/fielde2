'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { LoadScript } from '@react-google-maps/api';
import type { Libraries } from '@react-google-maps/api';

const libraries: Libraries = ['places', 'geometry', 'drawing'];

// Dynamically import MapComponent to avoid SSR issues
const MapComponent = dynamic(() => import('./components/map/MapComponent'), {
  loading: () => <div>Loading map...</div>,
  ssr: false
});

export default function Home() {
  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
      libraries={libraries}
    >
      <main className="min-h-screen">
        <MapComponent onAreaUpdate={() => {}} />
      </main>
    </LoadScript>
  );
}
