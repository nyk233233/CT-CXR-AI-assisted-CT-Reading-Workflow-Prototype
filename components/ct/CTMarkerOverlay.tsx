"use client";

import { useEffect, useRef, useState } from "react";
import type { FindingMarkerShape, FindingStatus } from "@/lib/domain";

export type CTMarkerOverlayMarker = {
  x: number;
  y: number;
  radius?: number;
  shape?: FindingMarkerShape;
  label?: string;
  status?: FindingStatus;
  linkedSliceIndex?: number;
};

type DisplayPosition = {
  left: number;
  top: number;
};

type CTMarkerOverlayProps = {
  marker?: CTMarkerOverlayMarker | null;
  note?: string;
  visible: boolean;
};

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function calculateDisplayPosition(element: HTMLDivElement, marker: CTMarkerOverlayMarker): DisplayPosition {
  const { width, height } = element.getBoundingClientRect();
  const displaySize = Math.min(width, height);
  const offsetX = (width - displaySize) / 2;
  const offsetY = (height - displaySize) / 2;

  return {
    left: offsetX + clampUnit(marker.x) * displaySize,
    top: offsetY + clampUnit(marker.y) * displaySize,
  };
}

export function CTMarkerOverlay({ marker, note, visible }: CTMarkerOverlayProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<DisplayPosition | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !marker) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      setPosition(calculateDisplayPosition(layer, marker));
    };

    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(layer);

    return () => {
      resizeObserver.disconnect();
    };
  }, [marker]);

  const markerShape = marker?.shape ?? "box";
  const markerStatus = marker?.status ?? "detected";
  const shouldShowMarker = Boolean(marker && visible && position);

  return (
    <div ref={layerRef} className="ct-marker-layer" aria-hidden="true">
      {shouldShowMarker ? (
        <div
          className={`ct-marker ct-marker-${markerShape} ct-marker-${markerStatus}`}
          style={{
            left: position?.left,
            top: position?.top,
          }}
        >
          {markerShape === "crosshair" ? <span className="ct-marker-dot" /> : null}
          {marker?.label ? <span className="ct-marker-label">{marker.label}</span> : null}
        </div>
      ) : null}
      {note ? <div className="ct-marker-note">{note}</div> : null}
    </div>
  );
}
