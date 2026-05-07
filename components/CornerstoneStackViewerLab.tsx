"use client";

import { CTStackViewer } from "@/components/ct/CTStackViewer";

const CASE_ID = "lidc_case_002";
const INITIAL_STACK_INDEX = 130;

export function CornerstoneStackViewerLab() {
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
          <span className="badge accent">local DICOM stack</span>
        </div>
      </section>

      <section>
        <section className="panel stack" style={{ padding: 16 }}>
          <div>
            <h2 className="section-title">Cornerstone Stack Viewport</h2>
            <p className="section-note">Mouse wheel, buttons, and slider all update the active stack index.</p>
          </div>

          <CTStackViewer
            caseId={CASE_ID}
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
