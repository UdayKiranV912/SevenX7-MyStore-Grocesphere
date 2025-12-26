
import React, { useEffect, useRef, useState } from 'react';
import { Store, OrderMode } from '../types';
import { getRoute, watchLocation, clearWatch, ACCURACY_THRESHOLD } from '../services/locationService';

interface MapVisualizerProps {
  stores: Store[];
  userLat: number | null;
  userLng: number | null;
  userAccuracy?: number | null;
  selectedStore: Store | null;
  onSelectStore: (store: Store) => void;
  className?: string;
  mode: OrderMode; 
  showRoute?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  isSelectionMode?: boolean; 
  enableLiveTracking?: boolean;
  forcedCenter?: { lat: number; lng: number } | null;
  enableExternalNavigation?: boolean;
  driverLocation?: { lat: number; lng: number } | null;
}

const isValidCoord = (num: any): num is number => {
  return typeof num === 'number' && !isNaN(num) && isFinite(num);
};

export const MapVisualizer: React.FC<MapVisualizerProps> = ({ 
  stores, 
  userLat, 
  userLng, 
  userAccuracy,
  selectedStore, 
  onSelectStore, 
  className = "h-full",
  mode,
  showRoute = false,
  onMapClick,
  isSelectionMode = false,
  enableLiveTracking = true,
  forcedCenter,
  driverLocation
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(!isSelectionMode);
  const [internalUserLoc, setInternalUserLoc] = useState<{lat: number, lng: number, acc: number} | null>(null);

  const finalUserLat = internalUserLoc?.lat ?? userLat;
  const finalUserLng = internalUserLoc?.lng ?? userLng;
  const finalAccuracy = internalUserLoc?.acc ?? userAccuracy ?? 15;

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    let startLat = 12.9716;
    let startLng = 77.5946;

    if (forcedCenter && isValidCoord(forcedCenter.lat) && isValidCoord(forcedCenter.lng)) {
        startLat = forcedCenter.lat;
        startLng = forcedCenter.lng;
    } else if (selectedStore && isValidCoord(selectedStore.lat) && isValidCoord(selectedStore.lng)) {
        startLat = selectedStore.lat;
        startLng = selectedStore.lng;
    } else if (isValidCoord(finalUserLat) && isValidCoord(finalUserLng)) {
        startLat = finalUserLat;
        startLng = finalUserLng;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd'
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      
      if (isSelectionMode && onMapClick) {
          map.on('click', (e: any) => {
              onMapClick(e.latlng.lat, e.latlng.lng);
          });
      }

      map.on('dragstart', () => setIsFollowingUser(false));

      mapInstanceRef.current = map;
      setIsMapReady(true);
      
      const resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);

      return () => {
        resizeObserver.disconnect();
        if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      };
    } catch (err) { console.error("Map Error:", err); }
  }, [isSelectionMode, onMapClick]); 

  useEffect(() => {
    if (!enableLiveTracking || isSelectionMode) return;
    const watchId = watchLocation((loc) => {
        if (!isValidCoord(loc.lat) || !isValidCoord(loc.lng)) return;
        setInternalUserLoc({ lat: loc.lat, lng: loc.lng, acc: loc.accuracy });
    }, () => {});
    return () => clearWatch(watchId);
  }, [enableLiveTracking, isSelectionMode]);

  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L || !mapInstanceRef.current || !isValidCoord(finalUserLat) || !isValidCoord(finalUserLng)) return;

    const latLng: [number, number] = [finalUserLat, finalUserLng];

    if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng(latLng);
        accuracyCircleRef.current.setRadius(finalAccuracy);
    } else {
        accuracyCircleRef.current = L.circle(latLng, {
            radius: finalAccuracy,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.1,
            weight: 1,
            interactive: false
        }).addTo(mapInstanceRef.current);
    }

    // "You Are Here" Marker with Store Emoji as requested
    const userIconHtml = `
      <div class="relative flex flex-col items-center">
        <div class="bg-slate-900 w-12 h-12 rounded-[50%_50%_50%_6px] rotate-[-45deg] border-2 border-white shadow-2xl flex items-center justify-center transition-all duration-300 scale-110">
            <div class="rotate-[45deg] text-2xl">🏪</div>
        </div>
        <div class="absolute -top-10 whitespace-nowrap bg-white text-slate-900 px-3 py-1 rounded-full border border-slate-200 shadow-xl">
            <span class="text-[9px] font-black uppercase tracking-[0.2em]">You Are Here</span>
        </div>
        <div class="w-4 h-4 bg-emerald-400 rounded-full border-2 border-white absolute -bottom-2 blur-[2px] animate-pulse"></div>
      </div>
    `;

    if (userMarkerRef.current) { userMarkerRef.current.setLatLng(latLng); } 
    else {
        const icon = L.divIcon({ className: 'bg-transparent border-none', html: userIconHtml, iconSize: [48, 48], iconAnchor: [24, 48] });
        userMarkerRef.current = L.marker(latLng, { icon, zIndexOffset: 2000 }).addTo(mapInstanceRef.current);
    }

    if (!isSelectionMode && isFollowingUser) { mapInstanceRef.current.panTo(latLng); }
  }, [finalUserLat, finalUserLng, finalAccuracy, isMapReady, isSelectionMode, isFollowingUser]);

  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    stores.forEach(store => {
       if (!isValidCoord(store.lat) || !isValidCoord(store.lng)) return;
       const isSelected = selectedStore?.id === store.id;
       const color = store.type === 'Vegetables/Fruits' ? '#10b981' : store.type === 'Daily Needs / Milk Booth' ? '#3b82f6' : '#f59e0b';
       const emoji = store.type === 'Vegetables/Fruits' ? '🥦' : store.type === 'Daily Needs / Milk Booth' ? '🥛' : '🏪';
       const size = isSelected ? 42 : 32; 
       
       const iconHtml = `
          <div class="relative flex flex-col items-center">
            <div class="shadow-xl" style="background: ${color}; width: ${size}px; height: ${size}px; border-radius: 50% 50% 50% 6px; transform: rotate(-45deg); border: 2px solid white; display: flex; align-items: center; justify-content: center;">
                <div style="transform: rotate(45deg); font-size: ${size * 0.5}px;">${emoji}</div>
            </div>
          </div>
       `;
       const icon = L.divIcon({ className: 'bg-transparent', html: iconHtml, iconSize: [size, size], iconAnchor: [size/2, size] });
       L.marker([store.lat, store.lng], { icon }).on('click', () => onSelectStore(store)).addTo(markersLayerRef.current);
    });
  }, [stores, selectedStore, isMapReady]);

  return (
    <div className={`w-full bg-slate-100 relative overflow-hidden isolate ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {!isSelectionMode && (
          <div className="absolute bottom-4 right-4 z-[400]">
              <button onClick={() => setIsFollowingUser(true)} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-400 active:text-emerald-500 border border-slate-100 transition-all">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
              </button>
          </div>
      )}
    </div>
  );
};
