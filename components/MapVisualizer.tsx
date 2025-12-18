
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

const isValidCoord = (num: any) => typeof num === 'number' && !isNaN(num);

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
  const routeLayerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const userStoreMarkerRef = useRef<any>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(!isSelectionMode);
  const [internalUserLoc, setInternalUserLoc] = useState<{lat: number, lng: number, acc: number} | null>(null);

  const finalUserLat = internalUserLoc?.lat ?? userLat;
  const finalUserLng = internalUserLoc?.lng ?? userLng;
  const finalAccuracy = internalUserLoc?.acc ?? userAccuracy ?? 20;

  // Initialize Map
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
        startLat = finalUserLat!;
        startLng = finalUserLng!;
    }

    const map = L.map(mapContainerRef.current, {
      center: [startLat, startLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd'
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    map.on('dragstart', () => setIsFollowingUser(false));

    if (isSelectionMode && onMapClick) {
      map.on('move', () => {
        const center = map.getCenter();
        if (isValidCoord(center.lat) && isValidCoord(center.lng)) {
            onMapClick(center.lat, center.lng);
        }
      });
    }

    mapInstanceRef.current = map;
    setIsMapReady(true);
    
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); 

  // Watch Location
  useEffect(() => {
    if (!enableLiveTracking || isSelectionMode) return;
    
    let lastProcessedLoc: {lat: number, lng: number} | null = null;

    const watchId = watchLocation(
      (loc) => {
        if (!isValidCoord(loc.lat) || !isValidCoord(loc.lng)) return;

        const isBetterAccuracy = !internalUserLoc || loc.accuracy < internalUserLoc.acc;
        const isSignificantMove = !lastProcessedLoc || 
            (Math.abs(loc.lat - lastProcessedLoc.lat) > 0.00005 || Math.abs(loc.lng - lastProcessedLoc.lng) > 0.00005);

        if (loc.accuracy < 80 || isBetterAccuracy || isSignificantMove) {
           setInternalUserLoc({ lat: loc.lat, lng: loc.lng, acc: loc.accuracy });
           lastProcessedLoc = { lat: loc.lat, lng: loc.lng };
        }
      },
      () => {}
    );

    return () => clearWatch(watchId);
  }, [enableLiveTracking, isSelectionMode]);

  // Sync Current Location Marker
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L || !mapInstanceRef.current || !isValidCoord(finalUserLat) || !isValidCoord(finalUserLng)) return;

    const latLng = [finalUserLat, finalUserLng] as [number, number];

    // Accuracy Circle
    if (!isSelectionMode) {
        if (accuracyCircleRef.current) {
            accuracyCircleRef.current.setLatLng(latLng);
            accuracyCircleRef.current.setRadius(finalAccuracy);
        } else {
            accuracyCircleRef.current = L.circle(latLng, {
                radius: finalAccuracy,
                color: 'transparent',
                fillColor: '#10b981',
                fillOpacity: 0.1,
                className: 'accuracy-circle-smooth'
            }).addTo(mapInstanceRef.current);
        }
    }

    // User "Store" Style Marker
    const iconSize = 56;
    const storeIconHtml = `
      <div class="relative flex flex-col items-center group">
        <div class="store-pin shadow-lg hover-subtle" style="background: #10b981; width: ${iconSize}px; height: ${iconSize}px; border-radius: 50% 50% 50% 6px; transform: rotate(-45deg); border: 4px solid white; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <div style="transform: rotate(45deg); font-size: ${iconSize * 0.45}px;">🏪</div>
        </div>
        <div class="absolute -bottom-7 bg-slate-900 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[1001]">
            Your Location
        </div>
      </div>
    `;

    if (userStoreMarkerRef.current) {
        userStoreMarkerRef.current.setLatLng(latLng);
    } else {
        const icon = L.divIcon({
          className: 'bg-transparent border-none smooth-marker',
          html: storeIconHtml,
          iconSize: [iconSize, iconSize],
          iconAnchor: [iconSize/2, iconSize]
        });
        userStoreMarkerRef.current = L.marker(latLng, { icon, zIndexOffset: 1000 }).addTo(mapInstanceRef.current);
    }

    if (!isSelectionMode && isFollowingUser) {
       mapInstanceRef.current.flyTo(latLng, mapInstanceRef.current.getZoom(), {
           animate: true,
           duration: 1.5,
           easeLinearity: 0.25
       });
    }
  }, [finalUserLat, finalUserLng, finalAccuracy, isMapReady, isSelectionMode, isFollowingUser]);

  // Sync Other Stores
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L || isSelectionMode) return;
    markersLayerRef.current.clearLayers();

    stores.forEach(store => {
       if (!isValidCoord(store.lat) || !isValidCoord(store.lng)) return;

       const isSelected = selectedStore?.id === store.id;
       const color = store.type === 'produce' ? '#10b981' : store.type === 'dairy' ? '#3b82f6' : '#f59e0b';
       const size = isSelected ? 56 : 46; 

       const iconHtml = `
          <div class="relative flex flex-col items-center group">
            <div class="store-pin shadow-lg hover-subtle" style="background: ${color}; width: ${size}px; height: ${size}px; border-radius: 50% 50% 50% 6px; transform: rotate(-45deg); border: 3px solid white; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <div style="transform: rotate(45deg); font-size: ${size * 0.45}px;">🏪</div>
            </div>
            <div class="absolute -bottom-7 bg-slate-900 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[1001]">
                ${store.name}
            </div>
            ${isSelected ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></div>' : ''}
          </div>
       `;

       const icon = L.divIcon({ className: 'bg-transparent', html: iconHtml, iconSize: [size, size], iconAnchor: [size/2, size] });
       L.marker([store.lat, store.lng], { icon, zIndexOffset: isSelected ? 900 : 800 })
         .on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            onSelectStore(store);
         })
         .addTo(markersLayerRef.current);
    });
  }, [stores, selectedStore, isMapReady, isSelectionMode]);

  // Sync Driver
  useEffect(() => {
    const L = (window as any).L;
    if (!isMapReady || !L || !mapInstanceRef.current) return;

    if (!driverLocation || !isValidCoord(driverLocation.lat) || !isValidCoord(driverLocation.lng)) {
        if (driverMarkerRef.current) {
            driverMarkerRef.current.remove();
            driverMarkerRef.current = null;
        }
        return;
    }

    const latLng = [driverLocation.lat, driverLocation.lng] as [number, number];

    if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng(latLng);
    } else {
        const icon = L.divIcon({
          className: 'bg-transparent',
          html: `<div class="text-3xl filter drop-shadow-md">🛵</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        driverMarkerRef.current = L.marker(latLng, { icon, zIndexOffset: 950 }).addTo(mapInstanceRef.current);
    }
  }, [driverLocation, isMapReady]);

  // Handle flyTo on forcedCenter changes
  useEffect(() => {
    if (isMapReady && forcedCenter && isValidCoord(forcedCenter.lat) && isValidCoord(forcedCenter.lng)) {
        mapInstanceRef.current.flyTo([forcedCenter.lat, forcedCenter.lng], 17, { animate: true, duration: 2 });
    }
  }, [forcedCenter, isMapReady]);

  return (
    <div className={`w-full bg-slate-100 relative overflow-hidden isolate ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Attribution */}
      <div className="absolute bottom-1 right-2 z-[400] pointer-events-none">
          <p className="text-[7px] font-black text-slate-400/70 uppercase tracking-tighter">Powered by OpenStreetMap</p>
      </div>

      {isSelectionMode && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] pointer-events-none flex flex-col items-center -mt-[48px] animate-bounce-soft">
              <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-2xl border-[5px] border-white z-20">
                  <div className="w-3.5 h-3.5 bg-white rounded-full animate-pulse"></div>
              </div>
              <div className="w-1.5 h-8 bg-slate-900 mx-auto -mt-2 rounded-b-full shadow-lg"></div>
          </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-10 right-6 z-[400] flex flex-col gap-3">
          <button 
            onClick={() => { setIsFollowingUser(true); if(isValidCoord(finalUserLat)) mapInstanceRef.current.flyTo([finalUserLat, finalUserLng], 18); }}
            className={`w-14 h-14 bg-white/95 backdrop-blur-md rounded-[1.25rem] shadow-float flex items-center justify-center border border-white active:scale-90 transition-all ${isFollowingUser ? 'text-emerald-600 ring-2 ring-emerald-500/20' : 'text-slate-500'}`}
            title="Recenter"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
          </button>
      </div>

      <style>{`
        .smooth-marker { transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .accuracy-circle-smooth { transition: all 1s ease-in-out; }
        .store-pin:hover { 
            filter: brightness(1.1); 
            transform: rotate(-45deg) translateY(-8px) scale(1.15) !important; 
            box-shadow: 0 20px 30px -10px rgba(0,0,0,0.4) !important; 
        }
        .hover-subtle { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .leaflet-container { background: #f1f5f9 !important; }
      `}</style>
    </div>
  );
};
