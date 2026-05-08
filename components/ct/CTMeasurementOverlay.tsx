"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

export type MeasurementPoint = {
  x: number;
  y: number;
};

export type CTMeasurementOverlayItem = {
  points: MeasurementPoint[];
  label?: string;
};

type DisplayPoint = {
  left: number;
  top: number;
};

type CTMeasurementOverlayProps = {
  measurements: CTMeasurementOverlayItem[];
};

function getImageDisplayRect(element: HTMLElement) {
  const { width, height } = element.getBoundingClientRect();
  const displaySize = Math.min(width, height);

  return {
    displaySize,
    offsetX: (width - displaySize) / 2,
    offsetY: (height - displaySize) / 2,
  };
}

export function getNormalizedImagePoint(
  element: HTMLElement,
  event: ReactMouseEvent<HTMLElement> | MouseEvent,
): MeasurementPoint | null {
  const rect = element.getBoundingClientRect();
  const { displaySize, offsetX, offsetY } = getImageDisplayRect(element);
  const localX = event.clientX - rect.left - offsetX;
  const localY = event.clientY - rect.top - offsetY;

  if (localX < 0 || localY < 0 || localX > displaySize || localY > displaySize) {
    return null;
  }

  return {
    x: localX / displaySize,
    y: localY / displaySize,
  };
}

function toDisplayPoint(element: HTMLElement, point: MeasurementPoint): DisplayPoint {
  const { displaySize, offsetX, offsetY } = getImageDisplayRect(element);

  return {
    left: offsetX + point.x * displaySize,
    top: offsetY + point.y * displaySize,
  };
}

export function CTMeasurementOverlay({ measurements }: CTMeasurementOverlayProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [displayMeasurements, setDisplayMeasurements] = useState<
    Array<{
      points: DisplayPoint[];
      label?: string;
    }>
  >([]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const updateMeasurements = () => {
      setDisplayMeasurements(
        measurements.map((measurement) => ({
          ...measurement,
          points: measurement.points.map((point) => toDisplayPoint(layer, point)),
        })),
      );
    };

    updateMeasurements();

    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(layer);

    return () => {
      resizeObserver.disconnect();
    };
  }, [measurements]);

  return (
    <div ref={layerRef} className="ct-measurement-layer" aria-hidden="true">
      {displayMeasurements.map((measurement, index) => {
        const [pointA, pointB] = measurement.points;
        const midPoint =
          pointA && pointB
            ? {
                left: (pointA.left + pointB.left) / 2,
                top: (pointA.top + pointB.top) / 2,
              }
            : pointA;

        return (
          <div key={`${index}-${measurement.label ?? "draft"}`} className="ct-measurement-item">
            <svg className="ct-measurement-svg">
              {pointA && pointB ? (
                <line
                  className="ct-measurement-line"
                  x1={pointA.left}
                  x2={pointB.left}
                  y1={pointA.top}
                  y2={pointB.top}
                />
              ) : null}
            </svg>
            {measurement.points.map((point, pointIndex) => (
              <span
                key={pointIndex}
                className="ct-measurement-point"
                style={{
                  left: point.left,
                  top: point.top,
                }}
              />
            ))}
            {measurement.label && midPoint ? (
              <span
                className="ct-measurement-label"
                style={{
                  left: midPoint.left,
                  top: midPoint.top,
                }}
              >
                {measurement.label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
