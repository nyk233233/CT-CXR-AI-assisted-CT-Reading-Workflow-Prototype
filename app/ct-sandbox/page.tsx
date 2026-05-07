import { AppShell } from "@/components/AppShell";

const metadataCards = [
  { label: "Slices", value: "261 slices" },
  { label: "Matrix", value: "512 x 512" },
  { label: "Pixel spacing", value: "0.681641 mm" },
  { label: "Slice thickness", value: "1.25 mm" },
  { label: "Lung window", value: "center -600 / width 1500" },
];

const keyImages = [
  {
    label: "Upper lung",
    selection: "25% of z-sorted CT volume",
    instanceNumber: 196,
    zPosition: -253.25,
    src: "/ct-demo/lidc_case_002/key_upper_lung.png",
  },
  {
    label: "Middle lung",
    selection: "50% of z-sorted CT volume",
    instanceNumber: 131,
    zPosition: -172.0,
    src: "/ct-demo/lidc_case_002/key_middle_lung.png",
  },
  {
    label: "Lower lung",
    selection: "75% of z-sorted CT volume",
    instanceNumber: 66,
    zPosition: -90.75,
    src: "/ct-demo/lidc_case_002/key_lower_lung.png",
  },
];

export default function CtSandboxPage() {
  return (
    <AppShell>
      <main className="stack">
        <section className="panel stack" style={{ padding: 20 }}>
          <div className="split-row" style={{ alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0 }}>CT Sandbox: LIDC Case 002</h1>
              <p className="section-note" style={{ maxWidth: 820 }}>
                This page displays real CT DICOM preprocessing key images. It is a lightweight bridge from
                DICOM preprocessing toward future workstation viewer integration.
              </p>
            </div>
            <span className="badge accent">LIDC-IDRI CT</span>
          </div>
        </section>

        <section className="panel stack" style={{ padding: 20 }}>
          <div>
            <h2 className="section-title">CT Series Metadata</h2>
            <p className="section-note">Lung-window preprocessing summary for the exported case manifest.</p>
          </div>

          <div
            className="metric-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {metadataCards.map((item) => (
              <div
                key={item.label}
                className="metric-card panel-soft"
                style={{ padding: 14 }}
              >
                <div className="tiny">{item.label}</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel stack" style={{ padding: 20 }}>
          <div>
            <h2 className="section-title">Lung-window Key Images</h2>
            <p className="section-note">
              Three exported PNG slices from the z-sorted CT volume. This is not a DICOM viewer yet; it is the
              first static image handoff point for later viewer integration.
            </p>
          </div>

          <div
            className="grid-3"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {keyImages.map((image) => (
              <article key={image.src} className="panel-soft stack" style={{ padding: 14 }}>
                <div className="split-row">
                  <div>
                    <h3 className="section-title">{image.label}</h3>
                    <p className="section-note">{image.selection}</p>
                  </div>
                  <span className="badge">lung</span>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid var(--line)",
                    background: "#020617",
                  }}
                >
                  <img
                    src={image.src}
                    alt={`${image.label} lung-window CT key slice`}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "auto",
                    }}
                  />
                </div>

                <div className="badge-row">
                  <span className="badge">instance {image.instanceNumber}</span>
                  <span className="badge">z {image.zPosition}</span>
                  <span className="badge">window lung</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
