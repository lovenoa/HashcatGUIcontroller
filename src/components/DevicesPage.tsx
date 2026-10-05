import { Cpu, Gauge, RefreshCw, TriangleAlert } from "lucide-react";
import type { CapabilityProfile } from "../types";
import { Button, Section, StatusPill } from "./ui";

export function DevicesPage({
  profile,
  onProbe
}: {
  profile: CapabilityProfile;
  onProbe: () => void;
}) {
  return (
    <div className="single-page">
      <div className="page-toolbar">
        <div>
          <div className="eyebrow">BACKEND / DEVICE</div>
          <h1>设备与性能</h1>
          <p>查看 hashcat 实际发现的计算后端，并为任务选择合适的工作负载。</p>
        </div>
        <Button variant="quiet" icon={<RefreshCw size={15} />} onClick={onProbe}>
          重新探测
        </Button>
      </div>

      <Section
        title="计算后端"
        description="同一块 GPU 可能同时出现在 CUDA 和 OpenCL 中；hashcat 会按别名去重。"
      >
        {profile.devices.length ? (
          <div className="device-table-wrap">
            <table className="device-table">
              <thead>
                <tr>
                  <th>设备</th>
                  <th>后端</th>
                  <th>类型</th>
                  <th>计算单元</th>
                  <th>显存</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {profile.devices.map((device) => (
                  <tr key={`${device.backend}-${device.id}`}>
                    <td>
                      <div className="device-name">
                        <Cpu size={15} />
                        <strong>{device.name || `Device #${device.id}`}</strong>
                      </div>
                      <small>ID #{device.id}{device.clock ? ` · ${device.clock} MHz` : ""}</small>
                    </td>
                    <td>{device.backend}</td>
                    <td>{device.type}</td>
                    <td>{device.processors ?? "—"}</td>
                    <td>
                      <div>{device.memoryTotal || "—"}</div>
                      <small>可用 {device.memoryFree || "未知"}</small>
                    </td>
                    <td><StatusPill tone="success">可用</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Gauge size={24} />
            <strong>尚未获得本机设备信息</strong>
            <p>桌面模式运行探测后会显示 CUDA、HIP、Metal 和 OpenCL 后端。</p>
          </div>
        )}
      </Section>

      <Section title="配置建议" description="这些提示直接对应任务工作台中的性能参数。">
        <div className="recommendation-grid">
          <div className="recommendation">
            <StatusPill tone="neutral">日常使用</StatusPill>
            <strong>工作负载 2</strong>
            <p>保持桌面可响应，适合边学习边运行短任务。</p>
          </div>
          <div className="recommendation">
            <StatusPill tone="warning">独占设备</StatusPill>
            <strong>工作负载 3</strong>
            <p>速度更高，但可能导致界面卡顿和功耗显著上升。</p>
          </div>
          <div className="recommendation">
            <StatusPill tone="danger">谨慎设置</StatusPill>
            <strong>优化内核与手动 Kernel</strong>
            <p>只有在理解密码长度和兼容性影响后再覆盖自动调优。</p>
          </div>
        </div>
        {profile.probeWarnings.length ? (
          <div className="inline-warning">
            <TriangleAlert size={16} />
            <div>
              <strong>探测提示</strong>
              {profile.probeWarnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          </div>
        ) : null}
      </Section>
    </div>
  );
}
