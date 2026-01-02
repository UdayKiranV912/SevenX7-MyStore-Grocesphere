
/**
 * Service for Location Utilities using Free APIs
 * - OSRM for Routing (Driving Directions)
 * - Nominatim for Geocoding (Address Lookup)
 */

export interface RouteResult {
  coordinates: [number, number][]; // Array of [lat, lng]
  distance: number; // meters
  duration: number; // seconds
}

export const ACCURACY_THRESHOLD = 30; // Increased precision limit (meters)

const isValidCoord = (num: any) => typeof num === 'number' && !isNaN(num);

/**
 * Robust Browser Location Fetcher (Single Shot)
 * Utilizes hardware GPS with aggressive settings for maximum accuracy.
 */
export const getBrowserLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
  return new Promise((resolve, reject) => {
    // Comment: Cast navigator to any to avoid property existence checks on specific navigator interfaces
    if (!(navigator as any).geolocation) {
      reject(new Error("Geolocation not supported by this browser."));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 20000, // Wait longer for a better lock
      maximumAge: 0, // Force fresh reading
    };

    (navigator as any).geolocation.getCurrentPosition(
      (pos: GeolocationPosition) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (isValidCoord(lat) && isValidCoord(lng)) {
            resolve({
              lat,
              lng,
              accuracy: pos.coords.accuracy,
            });
        } else {
            reject(new Error("Invalid coordinates received."));
        }
      },
      (err: GeolocationPositionError) => {
        let msg = "Location error.";
        switch(err.code) {
            case 1: msg = "Please enable location permissions."; break;
            case 2: msg = "GPS signal weak. Move near a window."; break;
            case 3: msg = "Location request timed out."; break;
        }
        reject(new Error(msg));
      },
      options
    );
  });
};

/**
 * Real-time Location Watcher (Enhanced for Street-Level accuracy)
 */
export const watchLocation = (
  onLocation: (loc: { lat: number; lng: number; accuracy: number }) => void,
  onError: (err: any) => void
): number => {
  // Comment: Cast navigator to any to avoid property existence checks
  if (!(navigator as any).geolocation) return -1;
  
  return (navigator as any).geolocation.watchPosition(
    (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (isValidCoord(lat) && isValidCoord(lng)) {
          // Filter out low-accuracy jumps
          if (pos.coords.accuracy <= 100) {
            onLocation({
                lat,
                lng,
                accuracy: pos.coords.accuracy,
            });
          }
      }
    },
    (err: GeolocationPositionError) => {
      if (err.code !== 3) onError(err);
    },
    { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 0 
    }
  );
};

export const clearWatch = (watchId: number) => {
    // Comment: Cast navigator to any to avoid property existence checks
    if ((navigator as any).geolocation && watchId !== -1) {
        (navigator as any).geolocation.clearWatch(watchId);
    }
};

export const getRoute = async (startLat: number, startLng: number, endLat: number, endLng: number): Promise<RouteResult | null> => {
  if (!isValidCoord(startLat) || !isValidCoord(startLng) || !isValidCoord(endLat) || !isValidCoord(endLng)) return null;
  
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Route API failed');
    const data = await response.json();
    if (data.code === 'Ok' && data.routes?.length > 0) {
      const route = data.routes[0];
      return {
        coordinates: route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]),
        distance: route.distance, 
        duration: route.duration 
      };
    }
    return null;
  } catch (error) {
    return { coordinates: [[startLat, startLng], [endLat, endLng]], distance: 0, duration: 0 };
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    if (!isValidCoord(lat) || !isValidCoord(lng)) return null;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'User-Agent': 'Grocesphere-SphereMap/2.0' }
        });
        const data = await response.json();
        const addr = data.address;
        if (!addr) return data.display_name || null;
        const parts = [];
        if (addr.house_number) parts.push(addr.house_number);
        if (addr.road) parts.push(addr.road);
        if (addr.suburb) parts.push(addr.suburb);
        if (addr.city) parts.push(addr.city);
        return parts.length > 0 ? parts.join(', ') : data.display_name;
    } catch (error) {
        return null;
    }
};

/**
 * Geocoding Search using Nominatim (OSM)
 * Comment: Added searchAddress to resolve import error in AddressAutocomplete.tsx
 */
export const searchAddress = async (query: string): Promise<any[]> => {
  if (!query || query.length < 3) return [];
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`, {
      headers: { 'User-Agent': 'Grocesphere-SphereMap/2.0' }
    });
    const data = await response.json();
    if (!data) return [];
    // Map OSM 'lon' to 'lng' as expected by components like AddressAutocomplete
    return data.map((item: any) => ({
      ...item,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    }));
  } catch (error) {
    console.error("Geocoding search failed:", error);
    return [];
  }
};