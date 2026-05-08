"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, WheelEvent } from "react";
import { CTMarkerOverlay } from "@/components/ct/CTMarkerOverlay";
import type { CTMarkerOverlayMarker } from "@/components/ct/CTMarkerOverlay";
import { CTMeasurementOverlay, getNormalizedImagePoint } from "@/components/ct/CTMeasurementOverlay";
import type { CTMeasurementOverlayItem, MeasurementPoint } from "@/components/ct/CTMeasurementOverlay";

const DEFAULT_INITIAL_STACK_INDEX = 130;
let renderingEngineCounter = 0;

export type CtStackDataSource = "local" | "orthanc-dicomweb";
export type WindowPreset = "lung" | "mediastinum" | "bone";

const WINDOW_PRESETS: Record<WindowPreset, { label: string; center: number; width: number }> = {
  lung: { label: "Lung", center: -600, width: 1500 },
  mediastinum: { label: "Mediastinum", center: 40, width: 400 },
  bone: { label: "Bone", center: 300, width: 1500 },
};

export type CtStackSlice = {
  sopInstanceUid?: string;
  stackIndex: number;
  sliceIndex?: number;
  instanceNumber?: number;
  zPosition?: number;
};

export type CtStackManifest = {
  caseId: string;
  source?: CtStackDataSource;
  studyId?: string;
  seriesId: string;
  numSlices: number;
  rows: number;
  columns: number;
  pixelSpacing?: [number, number] | null;
  sliceThickness?: number;
  rescaleSlope?: number;
  rescaleIntercept?: number;
  slices: CtStackSlice[];
};

type OrthancCtManifestResponse = {
  source: "orthanc-dicomweb";
  caseId: string;
  studyInstanceUid: string;
  ctSeriesInstanceUid: string;
  count: number;
  rows?: number | null;
  columns?: number | null;
  pixelSpacing?: [number, number] | null;
  sliceThickness?: number | null;
  rescaleSlope?: number | null;
  rescaleIntercept?: number | null;
  instances: Array<{
    sopInstanceUid: string;
    instanceNumber?: number | null;
    zPosition?: number | null;
  }>;
};

export type CtStackViewerState = {
  currentIndex: number;
  currentSlice: CtStackSlice | null;
  manifest: CtStackManifest | null;
  status: ViewerStatus;
  errorMessage: string | null;
  windowPreset: WindowPreset;
};

type ViewerStatus = "idle" | "loading-manifest" | "initializing-viewer" | "ready" | "error";

type CTStackViewerProps = {
  caseId: string;
  compact?: boolean;
  dataSource?: CtStackDataSource;
  height?: string;
  initialStackIndex?: number;
  onStateChange?: (state: CtStackViewerState) => void;
  onImageClick?: (point: MeasurementPoint) => void;
  selectedSliceIndex?: number;
  selectedSliceMode?: "instanceNumber" | "stackIndex";
  showDeveloperPreview?: boolean;
  showMetadata?: boolean;
  marker?: CTMarkerOverlayMarker | null;
  measurementCursorActive?: boolean;
  measurements?: CTMeasurementOverlayItem[];
  targetSliceIndex?: number;
  targetSliceKey?: string;
  targetSliceMode?: "instanceNumber" | "stackIndex";
};

function clampIndex(index: number, maxIndex: number): number {
  return Math.max(0, Math.min(index, maxIndex));
}

function formatNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "-";
}

function getVoiRange(preset: WindowPreset): { lower: number; upper: number } {
  const { center, width } = WINDOW_PRESETS[preset];

  return {
    lower: center - width / 2,
    upper: center + width / 2,
  };
}

function resolveStackIndex(
  manifest: CtStackManifest,
  target: number | undefined,
  mode: "instanceNumber" | "stackIndex",
): number | undefined {
  if (typeof target !== "number") return undefined;

  if (mode === "instanceNumber") {
    const exactInstance = manifest.slices.find((slice) => slice.instanceNumber === target);
    if (exactInstance) return exactInstance.stackIndex;
  }

  const exactStack = manifest.slices.find((slice) => slice.stackIndex === target);
  if (exactStack) return exactStack.stackIndex;

  const nearest = manifest.slices.reduce<CtStackSlice | null>((best, slice) => {
    if (!best) return slice;

    const sliceValue = mode === "instanceNumber" ? slice.instanceNumber ?? slice.stackIndex : slice.stackIndex;
    const bestValue = mode === "instanceNumber" ? best.instanceNumber ?? best.stackIndex : best.stackIndex;

    return Math.abs(sliceValue - target) < Math.abs(bestValue - target) ? slice : best;
  }, null);

  return nearest?.stackIndex;
}

function normalizeLocalManifest(rawManifest: CtStackManifest): CtStackManifest {
  return {
    ...rawManifest,
    source: rawManifest.source ?? "local",
    slices: [...rawManifest.slices].sort((a, b) => a.stackIndex - b.stackIndex),
  };
}

function normalizeOrthancManifest(rawManifest: OrthancCtManifestResponse): CtStackManifest {
  const slices = rawManifest.instances.map<CtStackSlice>((instance, index) => ({
    sopInstanceUid: instance.sopInstanceUid,
    stackIndex: index,
    sliceIndex: instance.instanceNumber ?? index,
    instanceNumber: instance.instanceNumber ?? undefined,
    zPosition: instance.zPosition ?? undefined,
  }));

  return {
    caseId: rawManifest.caseId,
    source: "orthanc-dicomweb",
    studyId: rawManifest.studyInstanceUid,
    seriesId: rawManifest.ctSeriesInstanceUid,
    numSlices: rawManifest.count,
    rows: rawManifest.rows ?? 0,
    columns: rawManifest.columns ?? 0,
    pixelSpacing: rawManifest.pixelSpacing ?? null,
    sliceThickness: rawManifest.sliceThickness ?? undefined,
    rescaleSlope: rawManifest.rescaleSlope ?? undefined,
    rescaleIntercept: rawManifest.rescaleIntercept ?? undefined,
    slices,
  };
}

function buildManifestUrl(caseId: string, dataSource: CtStackDataSource): string {
  if (dataSource === "orthanc-dicomweb") {
    return "/api/dicomweb/lidc-case-002/manifest";
  }

  return `/api/dicom/local/${caseId}/manifest`;
}

function buildImageIds(
  manifest: CtStackManifest,
  caseId: string,
  dataSource: CtStackDataSource,
  origin: string,
): string[] {
  if (dataSource === "orthanc-dicomweb") {
    return manifest.slices.map((slice) => {
      if (!slice.sopInstanceUid) {
        throw new Error(`Orthanc slice is missing SOPInstanceUID at stackIndex ${slice.stackIndex}`);
      }

      return `wadouri:${origin}/api/dicomweb/lidc-case-002/instances/${encodeURIComponent(slice.sopInstanceUid)}/dicom`;
    });
  }

  return manifest.slices.map(
    (slice) => `wadouri:${origin}/api/dicom/local/${caseId}/${slice.stackIndex}`,
  );
}

export function CTStackViewer({
  caseId,
  compact = false,
  dataSource = "local",
  height,
  initialStackIndex = DEFAULT_INITIAL_STACK_INDEX,
  onImageClick,
  onStateChange,
  selectedSliceIndex,
  selectedSliceMode = "instanceNumber",
  showDeveloperPreview = false,
  showMetadata = true,
  marker,
  measurementCursorActive = false,
  measurements = [],
  targetSliceIndex,
  targetSliceKey,
  targetSliceMode,
}: CTStackViewerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<any>(null);
  const renderingEngineRef = useRef<any>(null);
  const imageIdsRef = useRef<string[]>([]);
  const lastJumpTargetRef = useRef<string | null>(null);
  const engineIdsRef = useRef({
    renderingEngineId: `ct-stack-rendering-engine-${++renderingEngineCounter}`,
    viewportId: `ct-stack-viewport-${renderingEngineCounter}`,
  });
  const [manifest, setManifest] = useState<CtStackManifest | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialStackIndex);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [windowPreset, setWindowPreset] = useState<WindowPreset>("lung");
  const effectiveTargetSliceIndex = targetSliceIndex ?? selectedSliceIndex;
  const effectiveTargetSliceMode = targetSliceMode ?? selectedSliceMode;
  const activeWindowPreset = WINDOW_PRESETS[windowPreset];

  const currentSlice = useMemo(
    () => manifest?.slices.find((slice) => slice.stackIndex === currentIndex) ?? null,
    [currentIndex, manifest],
  );
  const markerVisible = Boolean(
    marker &&
      currentSlice &&
      typeof marker.linkedSliceIndex === "number" &&
      (currentSlice.instanceNumber === marker.linkedSliceIndex || currentSlice.sliceIndex === marker.linkedSliceIndex),
  );
  const markerNote =
    marker === undefined
      ? undefined
      : marker
        ? markerVisible
          ? "Mock marker overlay for workflow demonstration."
          : `Selected finding marker is linked to slice ${marker.linkedSliceIndex ?? "-"}.`
        : "No marker available for selected finding.";

  const maxIndex = manifest ? Math.max(0, manifest.numSlices - 1) : 0;

  const setViewportIndex = useCallback(
    async (nextIndex: number) => {
      if (!manifest || !viewportRef.current) return;

      const clampedIndex = clampIndex(nextIndex, maxIndex);
      await viewportRef.current.setImageIdIndex(clampedIndex);
      viewportRef.current.render();
      setCurrentIndex(clampedIndex);
    },
    [manifest, maxIndex],
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeViewer() {
      try {
        setStatus("loading-manifest");
        setErrorMessage(null);

        const manifestResponse = await fetch(buildManifestUrl(caseId, dataSource), {
          cache: "no-store",
        });

        if (!manifestResponse.ok) {
          throw new Error(`Manifest request failed: ${manifestResponse.status} ${manifestResponse.statusText}`);
        }

        const loadedManifest = await manifestResponse.json();
        if (cancelled) return;

        const normalizedManifest =
          dataSource === "orthanc-dicomweb"
            ? normalizeOrthancManifest(loadedManifest as OrthancCtManifestResponse)
            : normalizeLocalManifest(loadedManifest as CtStackManifest);
        const origin = window.location.origin;
        const imageIds = buildImageIds(normalizedManifest, caseId, dataSource, origin);
        const initialIndex = clampIndex(
          resolveStackIndex(normalizedManifest, effectiveTargetSliceIndex, effectiveTargetSliceMode) ?? initialStackIndex,
          Math.max(0, normalizedManifest.numSlices - 1),
        );

        imageIdsRef.current = imageIds;
        setManifest(normalizedManifest);
        setCurrentIndex(initialIndex);
        setStatus("initializing-viewer");

        const cornerstoneCore = await import("@cornerstonejs/core");
        const dicomImageLoader = await import("@cornerstonejs/dicom-image-loader");

        cornerstoneCore.init();

        try {
          dicomImageLoader.default?.init?.({ maxWebWorkers: 1 });
        } catch {
          dicomImageLoader.default?.init?.();
        }

        if (!elementRef.current || cancelled) return;

        const renderingEngine = new cornerstoneCore.RenderingEngine(engineIdsRef.current.renderingEngineId);
        renderingEngineRef.current = renderingEngine;
        renderingEngine.enableElement({
          viewportId: engineIdsRef.current.viewportId,
          type: cornerstoneCore.Enums.ViewportType.STACK,
          element: elementRef.current,
        });

        const viewport = renderingEngine.getViewport(engineIdsRef.current.viewportId) as any;
        viewportRef.current = viewport;

        await viewport.setStack(imageIds, initialIndex);
        viewport.setProperties?.({
          voiRange: getVoiRange(windowPreset),
        });
        viewport.render();

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void initializeViewer();

    return () => {
      cancelled = true;
      viewportRef.current = null;
      try {
        renderingEngineRef.current?.destroy?.();
      } catch {
        // Hot reload can destroy the underlying engine first; ignore cleanup races.
      }
      renderingEngineRef.current = null;
    };
  }, [caseId, dataSource, initialStackIndex]);

  useEffect(() => {
    if (status !== "ready" || !viewportRef.current) return;

    viewportRef.current.setProperties?.({
      voiRange: getVoiRange(windowPreset),
    });
    viewportRef.current.render();
  }, [status, windowPreset]);

  useEffect(() => {
    if (!manifest || status !== "ready") return;
    if (typeof effectiveTargetSliceIndex !== "number") return;

    const jumpTargetKey = `${targetSliceKey ?? "slice"}:${effectiveTargetSliceMode}:${effectiveTargetSliceIndex}`;
    if (lastJumpTargetRef.current === jumpTargetKey) return;

    const resolvedStackIndex = resolveStackIndex(manifest, effectiveTargetSliceIndex, effectiveTargetSliceMode);
    if (typeof resolvedStackIndex === "number" && resolvedStackIndex !== currentIndex) {
      void setViewportIndex(resolvedStackIndex);
    }
    lastJumpTargetRef.current = jumpTargetKey;
  }, [currentIndex, effectiveTargetSliceIndex, effectiveTargetSliceMode, manifest, setViewportIndex, status, targetSliceKey]);

  useEffect(() => {
    onStateChange?.({
      currentIndex,
      currentSlice,
      manifest,
      status,
      errorMessage,
      windowPreset,
    });
  }, [currentIndex, currentSlice, errorMessage, manifest, onStateChange, status, windowPreset]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (status !== "ready") return;
      event.preventDefault();

      const delta = event.deltaY > 0 ? 1 : -1;
      void setViewportIndex(currentIndex + delta);
    },
    [currentIndex, setViewportIndex, status],
  );

  const handleImageClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!onImageClick) return;

      const point = getNormalizedImagePoint(event.currentTarget, event);
      if (!point) return;

      onImageClick(point);
    },
    [onImageClick],
  );

  const imageIdPreview = imageIdsRef.current.slice(Math.max(0, currentIndex - 2), currentIndex + 3);

  return (
    <div className={`ct-stack-viewer ${compact ? "compact" : ""}`}>
      <div
        className={`cornerstone-viewport-frame ${measurementCursorActive ? "measurement-active" : ""}`}
        onClick={handleImageClick}
        onWheel={handleWheel}
        style={height ? { height } : undefined}
      >
        <div ref={elementRef} className="cornerstone-viewport" />
        <CTMarkerOverlay marker={marker} note={markerNote} visible={markerVisible} />
        <CTMeasurementOverlay measurements={measurements} />
        {status !== "ready" ? (
          <div className="cornerstone-viewport-overlay">
            <strong>{status === "error" ? "Viewer initialization failed" : "Loading CT stack..."}</strong>
            <span>{errorMessage ?? "Preparing Cornerstone3D rendering engine."}</span>
          </div>
        ) : null}
      </div>

      <div className="ct-stack-controls panel-soft">
        <div className="split-row">
          <div className="badge-row">
            <span className="badge accent">stackIndex {currentIndex}</span>
            <span className="badge">instance {formatNumber(currentSlice?.instanceNumber)}</span>
            <span className="badge">z {formatNumber(currentSlice?.zPosition)}</span>
            <span className="badge">
              {activeWindowPreset.label} · C {activeWindowPreset.center} / W {activeWindowPreset.width}
            </span>
          </div>
          <span className={`badge ${status === "ready" ? "accent" : status === "error" ? "danger" : "warn"}`}>
            {status}
          </span>
        </div>

        <div className="toolbar" style={{ marginTop: 10 }}>
          <button className="button ghost" disabled={status !== "ready" || currentIndex <= 0} onClick={() => void setViewportIndex(currentIndex - 1)}>
            Prev
          </button>
          <button className="button primary" disabled={status !== "ready"} onClick={() => void setViewportIndex(initialStackIndex)}>
            Middle
          </button>
          <button className="button ghost" disabled={status !== "ready" || currentIndex >= maxIndex} onClick={() => void setViewportIndex(currentIndex + 1)}>
            Next
          </button>
        </div>

        <div className="window-preset-row">
          <span className="tiny">Window:</span>
          {(Object.keys(WINDOW_PRESETS) as WindowPreset[]).map((presetKey) => {
            const preset = WINDOW_PRESETS[presetKey];

            return (
              <button
                key={presetKey}
                className={`window-preset-button ${windowPreset === presetKey ? "active" : ""}`}
                disabled={status !== "ready"}
                onClick={() => setWindowPreset(presetKey)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <input
          aria-label="CT stack index"
          className="viewer-lab-slider"
          disabled={status !== "ready"}
          max={maxIndex}
          min={0}
          type="range"
          value={currentIndex}
          onChange={(event) => void setViewportIndex(Number(event.target.value))}
        />
      </div>

      {showMetadata ? (
        <div className={`ct-stack-metadata-grid ${compact ? "compact" : ""}`}>
          <section className="panel-soft stack" style={{ padding: 12 }}>
            <h3 className="section-title">Stack Metadata</h3>
            <div className="viewer-lab-metadata">
              <span>caseId</span><strong>{manifest?.caseId ?? "-"}</strong>
              <span>source</span><strong>{manifest?.source ?? "local"}</strong>
              <span>seriesId</span><strong>{manifest?.seriesId ?? "-"}</strong>
              <span>numSlices</span><strong>{manifest?.numSlices ?? "-"}</strong>
              <span>matrix</span><strong>{manifest ? `${manifest.rows} x ${manifest.columns}` : "-"}</strong>
              <span>pixelSpacing</span><strong>{manifest?.pixelSpacing?.join(" x ") ?? "-"}</strong>
              <span>sliceThickness</span><strong>{formatNumber(manifest?.sliceThickness)}</strong>
              <span>rescaleSlope</span><strong>{formatNumber(manifest?.rescaleSlope)}</strong>
              <span>rescaleIntercept</span><strong>{formatNumber(manifest?.rescaleIntercept)}</strong>
              <span>window</span><strong>{activeWindowPreset.label}</strong>
              <span>WC / WW</span><strong>{activeWindowPreset.center} / {activeWindowPreset.width}</strong>
            </div>
          </section>

          <section className="panel-soft stack" style={{ padding: 12 }}>
            <h3 className="section-title">Current Slice</h3>
            <div className="viewer-lab-metadata">
              <span>stackIndex</span><strong>{currentSlice?.stackIndex ?? currentIndex}</strong>
              <span>instanceNumber</span><strong>{formatNumber(currentSlice?.instanceNumber)}</strong>
              <span>zPosition</span><strong>{formatNumber(currentSlice?.zPosition)}</strong>
              <span>SOPInstanceUID</span><strong className="mono-wrap">{currentSlice?.sopInstanceUid ?? "-"}</strong>
            </div>
          </section>
        </div>
      ) : null}

      {showDeveloperPreview ? (
        <details className="panel-soft" style={{ padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Developer Notes / imageIds preview</summary>
          <pre style={{ margin: "12px 0 0", whiteSpace: "pre-wrap", fontSize: 12 }}>
            {imageIdPreview.length > 0 ? imageIdPreview.join("\n") : "imageIds will appear after manifest loading."}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
