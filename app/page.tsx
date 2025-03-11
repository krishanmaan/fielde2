'use client';

import { NextPage } from 'next';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import GoogleMap from './components/GoogleMap';

// Update dynamic import to use named export
const PolygonDrawingTool = dynamic(
  () => import('./components/PolygonDrawingTool').then(mod => ({ default: mod.PolygonDrawingTool })),
  {
    ssr: false,
  }
);

const Home: NextPage = () => {
  const [area, setArea] = useState<number>(0);

  const handleAreaUpdate = (newArea: number) => {
    setArea(newArea);
  };

  return (
    <main className="min-h-screen">
      <div className="h-screen">
        <GoogleMap onAreaUpdate={handleAreaUpdate} />
      </div>
      {/* You can display the area somewhere else in your page if needed */}
      {area > 0 && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg">
          <p>Total Area: {area.toFixed(2)} hectares</p>
        </div>
      )}
    </main>
  );
};

export default Home;
