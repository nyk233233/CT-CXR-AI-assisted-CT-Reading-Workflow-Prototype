"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WheelEvent } from "react";

const CASE_ID = "lidc_case_002";
const INITIAL_STACK_INDEX = 130;
const RENDERING_ENGINE_ID = "ct-stack-lab-rendering-engine";
const VIEWPORT_ID = "ct-stack-lab-viewport";

type CtStackSlice = {
  sopInstanceUid?: string;
  stackIndex: number;
  sliceIndex?: number;
  instanceNumber?: number;
  zPosition?: number;
};

type CtStackManifest = {
  caseId: string;
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

type ViewerStatus = "idle" | "loading-manifest" | "initializing-viewer" | "ready" | "error";

function clampIndex(index: number, maxIndex: number): number {
  return Math.max(0, Math.min(index, maxIndex));
}

function formatNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "-";
}

export function CornerstoneStackViewerLab() {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<any>(null);
  const renderingEngineRef = useRef<any>(null);
  const imageIdsRef = useRef<string[]>([]);
  const [manifest, setManifest] = useState<CtStackManifest | null>(null);
  const [currentIndex, setCurrentIndex] = useState(INITIAL_STACK_INDEX);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentSlice = useMemo(
    () => manifest?.slices.find((slice) => slice.stackIndex === currentIndex) ?? null,
    [currentIndex, manifest],
  );

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

        const manifestResponse = await fetch(`/api/dicom/local/${CASE_ID}/manifest`, {
          cache: "no-store",
        });

        if (!manifestResponse.ok) {
          throw new Error(`Manifest request failed: ${manifestResponse.status} ${manifestResponse.statusText}`);
        }

        const loadedManifest = (await manifestResponse.json()) as CtStackManifest;
        if (cancelled) return;

        const sortedSlices = [...loadedManifest.slices].sort((a, b) => a.stackIndex - b.stackIndex);
        const normalizedManifest = { ...loadedManifest, slices: sortedSlices };
        const origin = window.location.origin;
        const imageIds = sortedSlices.map(
          (slice) => `wadouri:${origin}/api/dicom/local/${CASE_ID}/${slice.stackIndex}`,
        );

        imageIdsRef.current = imageIds;
        setManifest(normalizedManifest);
        setCurrentIndex(INITIAL_STACK_INDEX);
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

        const renderingEngine = new cornerstoneCore.RenderingEngine(RENDERING_ENGINE_ID);
        renderingEngineRef.current = renderingEngine;
        renderingEngine.enableElement({
          viewportId: VIEWPORT_ID,
          type: cornerstoneCore.Enums.ViewportType.STACK,
          element: elementRef.current,
        });

        const viewport = renderingEngine.getViewport(VIEWPORT_ID) as any;
        viewportRef.current = viewport;

        await viewport.setStack(imageIds, INITIAL_STACK_INDEX);
        viewport.setProperties?.({
          voiRange: {
            lower: -1350,
            upper: 150,
          },
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
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (status !== "ready") return;
      event.preventDefault();

      const delta = event.deltaY > 0 ? 1 : -1;
      void setViewportIndex(currentIndex + delta);
    },
    [currentIndex, setViewportIndex, status],
  );

  const imageIdPreview = imageIdsRef.current.slice(Math.max(0, currentIndex - 2), currentIndex + 3);

  return (
    <main className="stack">
      <section className="panel stack" style={{ padding: 20 }}>
        <div className="split-row" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0 }}>Viewer Lab / CT Stack</h1>
            <p className="section-note" style={{ maxWidth: 840 }}>
              Cornerstone3D stack viewport using local DICOM API. This lab is separate from the main workstation until stable.
            </p>
          </div>
          <span className={`badge ${status === "ready" ? "accent" : status === "error" ? "danger" : "warn"}`}>
            {status}
          </span>
        </div>
      </section>

      <section className="viewer-lab-grid">
        <section className="panel stack" style={{ padding: 16 }}>
          <div className="split-row">
            <div>
              <h2 className="section-title">Cornerstone Stack Viewport</h2>
              <p className="section-note">Mouse wheel, buttons, and slider all update the active stack index.</p>
            </div>
            <span className="badge accent">stackIndex {currentIndex}</span>
          </div>

          <div className="cornerstone-viewport-frame" onWheel={handleWheel}>
            <div ref={elementRef} className="cornerstone-viewport" />
            {status !== "ready" ? (
              <div className="cornerstone-viewport-overlay">
                <strong>{status === "error" ? "Viewer initialization failed" : "Loading CT stack..."}</strong>
                <span>{errorMessage ?? "Preparing Cornerstone3D rendering engine."}</span>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="stack">
          <section className="panel stack" style={{ padding: 16 }}>
            <div>
              <h3 className="section-title">Stack Metadata</h3>
              <p className="section-note">Manifest summary from local CT preprocessing.</p>
            </div>
            <div className="viewer-lab-metadata">
              <span>caseId</span><strong>{manifest?.caseId ?? "-"}</strong>
              <span>seriesId</span><strong>{manifest?.seriesId ?? "-"}</strong>
              <span>numSlices</span><strong>{manifest?.numSlices ?? "-"}</strong>
              <span>matrix</span><strong>{manifest ? `${manifest.rows} x ${manifest.columns}` : "-"}</strong>
              <span>pixelSpacing</span><strong>{manifest?.pixelSpacing?.join(" x ") ?? "-"}</strong>
              <span>sliceThickness</span><strong>{formatNumber(manifest?.sliceThickness)}</strong>
              <span>rescaleSlope</span><strong>{formatNumber(manifest?.rescaleSlope)}</strong>
              <span>rescaleIntercept</span><strong>{formatNumber(manifest?.rescaleIntercept)}</strong>
            </div>
          </section>

          <section className="panel stack" style={{ padding: 16 }}>
            <div>
              <h3 className="section-title">Current Slice</h3>
              <p className="section-note">Active slice metadata follows the stack controls.</p>
            </div>
            <div className="viewer-lab-metadata">
              <span>stackIndex</span><strong>{currentSlice?.stackIndex ?? currentIndex}</strong>
              <span>instanceNumber</span><strong>{formatNumber(currentSlice?.instanceNumber)}</strong>
              <span>zPosition</span><strong>{formatNumber(currentSlice?.zPosition)}</strong>
              <span>SOPInstanceUID</span><strong className="mono-wrap">{currentSlice?.sopInstanceUid ?? "-"}</strong>
            </div>
          </section>

          <section className="panel stack" style={{ padding: 16 }}>
            <div>
              <h3 className="section-title">Controls</h3>
              <p className="section-note">Default opens the middle demonstration slice.</p>
            </div>
            <div className="toolbar">
              <button className="button ghost" disabled={status !== "ready" || currentIndex <= 0} onClick={() => void setViewportIndex(currentIndex - 1)}>
                Prev
              </button>
              <button className="button primary" disabled={status !== "ready"} onClick={() => void setViewportIndex(INITIAL_STACK_INDEX)}>
                Middle
              </button>
              <button className="button ghost" disabled={status !== "ready" || currentIndex >= maxIndex} onClick={() => void setViewportIndex(currentIndex + 1)}>
                Next
              </button>
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
          </section>

          <section className="panel stack" style={{ padding: 16 }}>
            <div className="split-row">
              <h3 className="section-title">Status</h3>
              <span className={`badge ${status === "ready" ? "accent" : status === "error" ? "danger" : "warn"}`}>
                {status}
              </span>
            </div>
            <p className="section-note">
              {errorMessage ?? "Local DICOM API is used directly; Orthanc/OHIF are intentionally not involved in this lab."}
            </p>
          </section>
        </aside>
      </section>

      <details className="panel-soft" style={{ padding: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Developer Notes / imageIds preview</summary>
        <pre style={{ margin: "12px 0 0", whiteSpace: "pre-wrap", fontSize: 12 }}>
          {imageIdPreview.length > 0 ? imageIdPreview.join("\n") : "imageIds will appear after manifest loading."}
        </pre>
      </details>
    </main>
  );
}
