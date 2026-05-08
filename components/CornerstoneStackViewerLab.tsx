"use client";

import { useState } from "react";
import { CTStackViewer } from "@/components/ct/CTStackViewer";
import type { CtStackDataSource } from "@/components/ct/CTStackViewer";

const CASE_ID = "lidc_case_002";
const INITIAL_STACK_INDEX = 130;

export function CornerstoneStackViewerLab() {
  const [dataSource, setDataSource] = useState<CtStackDataSource>("local");

  return (
    <main className="stack">
      <section className="panel stack" style={{ padding: 20 }}>
        <div className="split-row" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0 }}>Viewer Lab / CT Stack</h1>
            <p className="section-note" style={{ maxWidth: 840 }}>
              Cornerstone3D stack viewport with switchable local and Orthanc DICOMweb datasource modes. This lab is separate from the main workstation until stable.
            </p>
          </div>
          <span className="badge accent">
            {dataSource === "orthanc-dicomweb" ? "orthanc-dicomweb" : "local DICOM stack"}
          </span>
        </div>
      </section>

      <section>
        <section className="panel stack" style={{ padding: 16 }}>
          <div>
            <h2 className="section-title">Cornerstone Stack Viewport</h2>
            <p className="section-note">Mouse wheel, buttons, and slider all update the active stack index.</p>
          </div>

          <div className="viewer-lab-source-toggle">
            <span className="tiny">Data source:</span>
            <button
              className={`button ${dataSource === "local" ? "primary" : "ghost"}`}
              onClick={() => setDataSource("local")}
            >
              Local API
            </button>
            <button
              className={`button ${dataSource === "orthanc-dicomweb" ? "primary" : "ghost"}`}
              onClick={() => setDataSource("orthanc-dicomweb")}
            >
              Orthanc DICOMweb beta
            </button>
          </div>

          <CTStackViewer
            key={dataSource}
            caseId={CASE_ID}
            dataSource={dataSource}
            height="600px"
            initialStackIndex={INITIAL_STACK_INDEX}
            showDeveloperPreview
            showMetadata
          />
        </section>
      </section>
    </main>
  );
}
