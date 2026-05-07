import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getWorklist } from "@/lib/mock/repository";

export default function WorklistPage() {
  const items = getWorklist();

  return (
    <AppShell>
      <section className="panel" style={{ padding: 20 }}>
        <div className="split-row" style={{ marginBottom: 18 }}>
          <div>
            <h2 className="section-title">Worklist / 任务入口</h2>
            <p className="section-note">
              这个区域模拟真实影像科的任务台。教学重点是让你先理解病例从哪里进入系统，而不是一开始就做复杂 viewer。
            </p>
          </div>
          <div className="badge-row">
            <span className="badge accent">最小教学版</span>
            <span className="badge">CT 主线</span>
            <span className="badge">US 仅做参考对象</span>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 18 }}>
          <input defaultValue="" placeholder="教学版占位筛选：后续可接 q / status / priority" />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Description</th>
              <th>Priority</th>
              <th>Study Status</th>
              <th>Report Status</th>
              <th>Findings</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.studyId}>
                <td>
                  <strong>{item.patient.patientName}</strong>
                  <div className="tiny">
                    {item.patient.sex} / {item.patient.age} / {item.modality}
                  </div>
                </td>
                <td>
                  {item.description}
                  <div className="tiny">{item.studyDate}</div>
                </td>
                <td>
                  <span className={`badge ${item.priority === "stat" ? "danger" : item.priority === "urgent" ? "warn" : ""}`}>
                    {item.priority}
                  </span>
                </td>
                <td>{item.studyStatus}</td>
                <td>{item.reportStatus}</td>
                <td>{item.findingCount}</td>
                <td>
                  <Link className="button primary" href={`/workstation/${item.studyId}`}>
                    Open Study
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
