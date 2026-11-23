export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface EmergencyLocationSnapshot {
  latitude: number | null;
  longitude: number | null;
  locationShared: boolean;
  locationStatus: 'shared' | 'unavailable' | 'denied' | 'disabled';
  mapLink?: string;
}

export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return 'unsupported';
  }
  if (!('permissions' in navigator) || typeof navigator.permissions?.query !== 'function') {
    return 'prompt';
  }
  try {
    const res = await navigator.permissions.query({ name: 'geolocation' });
    if (res.state === 'granted' || res.state === 'denied' || res.state === 'prompt') {
      return res.state;
    }
    return 'prompt';
  } catch {
    return 'prompt';
  }
}

/**
 * Requests browser geolocation permission explicitly BEFORE an emergency occurs.
 * Does NOT track continuously in the background.
 */
export async function requestLocationPermissionPrecheck(): Promise<{
  ok: boolean;
  state: GeolocationPermissionState;
  message: string;
}> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return {
      ok: false,
      state: 'unsupported',
      message: 'Geolocation is not supported in this browser.',
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => {
        resolve({
          ok: true,
          state: 'granted',
          message:
            'Location permission granted. Coordinates will only be read at the moment an SOS alert is triggered.',
        });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        resolve({
          ok: false,
          state: denied ? 'denied' : 'prompt',
          message: denied
            ? 'Location permission was denied. SOS alerts will still work and will report "Location unavailable".'
            : 'Could not verify location right now, but SOS alerts will still work without location.',
        });
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60_000 }
    );
  });
}

/**
 * One-shot emergency location capture triggered ONLY at SOS activation time.
 * Never blocks emergency activation if permission is denied or GPS times out.
 */
export async function captureEmergencyLocationOnce(
  locationSharingEnabled: boolean,
  timeoutMs = 3500
): Promise<EmergencyLocationSnapshot> {
  if (!locationSharingEnabled) {
    return {
      latitude: null,
      longitude: null,
      locationShared: false,
      locationStatus: 'disabled',
    };
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return {
      latitude: null,
      longitude: null,
      locationShared: false,
      locationStatus: 'unavailable',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const hardTimer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({
        latitude: null,
        longitude: null,
        locationShared: false,
        locationStatus: 'unavailable',
      });
    }, timeoutMs + 200);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(hardTimer);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          resolve({
            latitude: null,
            longitude: null,
            locationShared: false,
            locationStatus: 'unavailable',
          });
          return;
        }
        resolve({
          latitude: lat,
          longitude: lng,
          locationShared: true,
          locationStatus: 'shared',
          mapLink: `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`,
        });
      },
      (err) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(hardTimer);
        resolve({
          latitude: null,
          longitude: null,
          locationShared: false,
          locationStatus: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 30_000,
      }
    );
  });
}
