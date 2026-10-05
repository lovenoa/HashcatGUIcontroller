import {
  Activity,
  BookOpenCheck,
  Cpu,
  FolderClock,
  FileStack,
  LayoutDashboard,
  ListFilter,
  Settings2,
  TerminalSquare,
  Wrench
} from "lucide-react";
import type { CapabilityProfile } from "../types";
import { StatusPill } from "./ui";

export type PageId = "workspace" | "algorithms" | "toolbox" | "devices" | "sessions" | "files" | "guidance" | "settings";

const navItems: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "workspace", label: "任务工作台", icon: LayoutDashboard },
  { id: "algorithms", label: "算法库", icon: ListFilter },
  { id: "toolbox", label: "工具箱", icon: Wrench },
  { id: "devices", label: "设备与性能", icon: Cpu },
  { id: "sessions", label: "运行记录", icon: FolderClock },
  { id: "files", label: "日志与文件", icon: FileStack }
];

export function Sidebar({
  active,
  onChange,
  profile
}: {
  active: PageId;
  onChange: (page: PageId) => void;
  profile: CapabilityProfile;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <TerminalSquare size={18} strokeWidth={2} />
        </div>
        <div>
          <strong>Hashcat Studio</strong>
          <span>LOCAL WORKSPACE</span>
        </div>
      </div>

      <nav className="nav" aria-label="主导航">
        <div className="nav-label">工作区</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${active === item.id ? "active" : ""}`}
              type="button"
              onClick={() => onChange(item.id)}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="runtime-card">
          <div className="runtime-card-title">
            <Activity size={15} />
            <span>运行时</span>
          </div>
          <div className="runtime-version">hashcat v{profile.hashcatVersion}</div>
          <StatusPill tone={profile.source === "live" ? "success" : "neutral"}>
            {profile.source === "live" ? "已连接本机" : "浏览器预览"}
          </StatusPill>
        </div>
        <button className="sidebar-link" type="button" onClick={() => onChange("guidance")}>
          <BookOpenCheck size={15} />
          <span>指导与文档</span>
        </button>
        <button className="sidebar-link" type="button" onClick={() => onChange("settings")}>
          <Settings2 size={15} />
          <span>应用设置</span>
        </button>
      </div>
    </aside>
  );
}
