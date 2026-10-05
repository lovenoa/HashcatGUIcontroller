import { BookOpen, ExternalLink, Info, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { CapabilityProfile, JobSpec } from "../types";
import { Button, Field, PathInput, Section, StatusPill } from "./ui";
import { openExternal } from "../lib/external";

export function GuidancePage({ profile }: { profile: CapabilityProfile }) {
  return (
    <div className="single-page">
      <div className="page-toolbar">
        <div>
          <div className="eyebrow">GUIDANCE / HASHCAT</div>
          <h1>指导与文档</h1>
          <p>短提示用于当前操作，完整资料保留给 hashcat 官方文档。</p>
        </div>
        <StatusPill tone="neutral">hashcat {profile.hashcatVersion}</StatusPill>
      </div>

      <Section title="标准工作流" description="每一步都对应任务工作台中的一个连续区域。">
        <div className="guidance-steps">
          {[
            ["01", "确认输入", "导入有权处理的离线哈希，识别或选择算法模式。"],
            ["02", "选择候选", "使用词表、规则、掩码或它们的组合。"],
            ["03", "检查命令", "在右侧命令检查器查看完整参数和冲突。"],
            ["04", "执行任务", "启动、暂停、checkpoint 停止并监控设备状态。"],
            ["05", "查看结果", "在快速预览、运行记录和 potfile 中检查恢复结果。"]
          ].map(([number, title, description]) => (
            <div className="guidance-step" key={number}>
              <span>{number}</span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="关键概念" description="保持简短；详细参数说明通过控件提示和官方资料查看。">
        <div className="guidance-grid">
          <div><BookOpen size={16} /><strong>哈希模式</strong><p>决定 hashcat 如何验证候选。</p></div>
          <div><SlidersHorizontal size={16} /><strong>攻击模式</strong><p>决定候选密码如何生成。</p></div>
          <div><ShieldCheck size={16} /><strong>恢复边界</strong><p>只处理有权审计的离线哈希。</p></div>
          <div><Info size={16} /><strong>优化内核</strong><p>更快，但可能限制密码长度和编码。</p></div>
        </div>
      </Section>

      <Section title="官方资料">
        <div className="document-links">
          {[
            ["hashcat 官网", "https://hashcat.net/hashcat/"],
            ["FAQ 与兼容性", "https://hashcat.net/faq/"],
            ["攻击模式 Wiki", "https://hashcat.net/wiki/"],
            ["GitHub 源码", "https://github.com/hashcat/hashcat"]
          ].map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void openExternal(href); }}>
              <ExternalLink size={14} />
              <span>{label}</span>
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function SettingsPage({
  job,
  profile,
  onChange,
  onProbe,
  onExport,
  onImport
}: {
  job: JobSpec;
  profile: CapabilityProfile;
  onChange: (job: JobSpec) => void;
  onProbe: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
}) {
  return (
    <div className="single-page">
      <div className="page-toolbar">
        <div>
          <div className="eyebrow">APPLICATION / LOCAL</div>
          <h1>应用设置</h1>
          <p>运行路径、任务文件和本地数据设置。</p>
        </div>
        <StatusPill tone={profile.source === "live" ? "success" : "neutral"}>
          {profile.source === "live" ? "桌面运行时" : "浏览器预览"}
        </StatusPill>
      </div>

      <Section
        title="Hashcat 运行时"
        description="切换可执行文件后重新探测参数、算法和设备。"
        action={<Button variant="quiet" onClick={onProbe}>重新探测</Button>}
      >
        <div className="settings-grid">
          <Field label="hashcat 可执行文件" hint="路径控件支持拖入文件。">
            <PathInput value={job.hashcatPath} onChange={(value) => onChange({ ...job, hashcatPath: value })} />
          </Field>
          <Field label="检测版本">
            <div className="readonly-value">{profile.hashcatVersion === "unknown" ? "未探测" : `v${profile.hashcatVersion}`}</div>
          </Field>
          <Field label="算法目录">
            <div className="readonly-value">{profile.hashModes.length} 个模式</div>
          </Field>
          <Field label="计算设备">
            <div className="readonly-value">{profile.devices.length ? `${profile.devices.length} 个设备` : "未检测"}</div>
          </Field>
        </div>
      </Section>

      <Section
        title="任务文件"
        description="导出完整 JobSpec，便于备份、复现和问题报告。"
        action={
          <div className="inline-actions">
            <Button variant="quiet" onClick={onExport}>导出 JSON</Button>
            <label className="button quiet file-button">
              <span>导入 JSON</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) onImport(await file.text());
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        }
      >
        <div className="settings-note">
          当前任务会自动保存到本地浏览器存储。敏感明文和运行日志不写入任务文件。
        </div>
      </Section>

      <Section title="本地数据" description="当前版本使用浏览器本地存储，SQLite 持久化将在发布阶段接入。">
        <div className="settings-grid">
          <Field label="任务草稿">
            <div className="readonly-value">自动保存</div>
          </Field>
          <Field label="运行历史">
            <div className="readonly-value">最近 20 条</div>
          </Field>
        </div>
      </Section>
    </div>
  );
}
