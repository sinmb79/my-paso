"use client";

import { useState } from "react";

import {
  getCurrentPosition,
  requestPermissions,
} from "@/lib/geo/gps-tracker";

type GPSState = {
  error: string | null;
  loading: boolean;
  permissionGranted: boolean;
  position: GeolocationPosition | null;
};

const INITIAL_STATE: GPSState = {
  position: null,
  loading: false,
  error: null,
  permissionGranted: false,
};

export function useGPS() {
  const [state, setState] = useState<GPSState>(INITIAL_STATE);

  async function requestAccess() {
    const granted = await requestPermissions();
    setState((current) => ({
      ...current,
      permissionGranted: granted,
      error: granted ? null : "Location permission is unavailable.",
    }));
    return granted;
  }

  async function updatePosition() {
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const position = await getCurrentPosition();
      setState((current) => ({
        ...current,
        loading: false,
        error: null,
        permissionGranted: true,
        position,
      }));

      return position;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read location.";
      setState((current) => ({
        ...current,
        loading: false,
        error: message,
      }));
      throw error;
    }
  }

  return {
    ...state,
    requestAccess,
    updatePosition,
  };
}
