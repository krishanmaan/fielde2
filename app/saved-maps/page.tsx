'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Field } from '../components/map/types';

interface SavedMap {
  id: string;
  name: string;
  description: string;
  group: string;
  field: Field;
  createdAt: string;
}

export default function SavedMaps() {
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);

  useEffect(() => {
    const maps = localStorage.getItem('savedMaps');
    if (maps) {
      setSavedMaps(JSON.parse(maps));
    }
  }, []);

  const handleDelete = (id: string) => {
    const newMaps = savedMaps.filter(map => map.id !== id);
    localStorage.setItem('savedMaps', JSON.stringify(newMaps));
    setSavedMaps(newMaps);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Saved Maps</h1>
        <Link 
          href="/"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          New Map
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {savedMaps.map((map) => (
          <div key={map.id} className="border rounded-lg p-4 shadow-md">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold">{map.name}</h2>
              <span className="px-2 py-1 bg-gray-200 rounded text-sm">
                {map.group}
              </span>
            </div>
            <p className="text-gray-600 mb-4">{map.description}</p>
            <div className="text-sm text-gray-500 mb-4">
              Created: {new Date(map.createdAt).toLocaleDateString()}
            </div>
            <div className="flex justify-between items-center">
              <Link
                href={`/?mapId=${map.id}`}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Open
              </Link>
              <button
                onClick={() => handleDelete(map.id)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {savedMaps.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500">
            No saved maps yet. Create a new map to get started!
          </div>
        )}
      </div>
    </div>
  );
} 