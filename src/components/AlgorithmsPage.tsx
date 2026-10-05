import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { CapabilityProfile } from "../types";
import { Button, Section, Select, StatusPill, TextInput } from "./ui";

export function AlgorithmsPage({ profile, onUseMode }: { profile: CapabilityProfile; onUseMode: (mode: number) => void }) {
  const [selectedId, setSelectedId] = useState(profile.hashModes[0]?.id ?? 0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [slowOnly, setSlowOnly] = useState(false);
  const selectedMode = profile.hashModes.find((mode) => mode.id === selectedId) ?? profile.hashModes[0];

  const categories = useMemo(() => {
    return [...new Set(profile.hashModes.map((mode) => mode.category))].sort();
  }, [profile.hashModes]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return profile.hashModes.filter((mode) => {
      const matchesQuery =
        !normalized ||
        String(mode.id).includes(normalized) ||
        mode.name.toLowerCase().includes(normalized) ||
        mode.exampleHash.toLowerCase().includes(normalized);
      const matchesCategory = category === "all" || mode.category === category;
      return matchesQuery && matchesCategory && (!slowOnly || mode.slowHash);
    });
  }, [category, profile.hashModes, query, slowOnly]);

  return (
    <div className="single-page">
      <div className="page-toolbar">
        <div>
          <div className="eyebrow">HASH MODE CATALOG</div>
          <h1>算法库</h1>
          <p>搜索 hashcat 7.1.2 内置哈希模式，查看格式、限制和官方示例。</p>
        </div>
        <StatusPill tone="success">{profile.hashModes.length} 个模式</StatusPill>
      </div>

      {selectedMode ? (
        <Section
          title="模式详情"
          description={`#${selectedMode.id} · ${selectedMode.name}`}
          action={<Button variant="primary" onClick={() => onUseMode(selectedMode.id)}>应用到任务</Button>}
        >
          <div className="algorithm-detail-grid">
            <div><span>类别</span><strong>{selectedMode.category}</strong></div>
            <div><span>密码长度</span><strong>{selectedMode.passwordMin}–{selectedMode.passwordMax}</strong></div>
            <div><span>内核</span><strong>{selectedMode.kernels.join(" · ")}</strong></div>
            <div><span>编码</span><strong>{selectedMode.encodings.join(" · ")}</strong></div>
            <div><span>慢哈希</span><strong>{selectedMode.slowHash ? "是" : "否"}</strong></div>
            <div><span>自动识别</span><strong>{selectedMode.autodetect ? "支持" : "关闭"}</strong></div>
            <div className="algorithm-example"><span>示例哈希</span><code>{selectedMode.exampleHash}</code></div>
          </div>
        </Section>
      ) : null}

      <Section title="模式目录" description="点击任意行查看详情，并可直接应用到当前任务。">
        <div className="catalog-toolbar">
          <div className="search-box">
            <Search size={16} />
            <TextInput value={query} onChange={setQuery} placeholder="搜索 ID、名称或示例哈希" ariaLabel="搜索哈希模式" />
          </div>
          <Select
            value={category}
            options={[{ value: "all", label: "全部类别" }, ...categories.map((item) => ({ value: item, label: item }))]}
            onChange={setCategory}
            ariaLabel="哈希类别"
          />
          <button className={`filter-toggle ${slowOnly ? "active" : ""}`} type="button" onClick={() => setSlowOnly(!slowOnly)}>
            <SlidersHorizontal size={15} />
            <span>仅慢哈希</span>
          </button>
        </div>

        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>模式</th>
                <th>名称</th>
                <th>类别</th>
                <th>密码长度</th>
                <th>内核</th>
                <th>示例</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 150).map((mode) => (
                <tr key={mode.id} className={selectedId === mode.id ? "selected" : ""} onClick={() => setSelectedId(mode.id)}>
                  <td><strong>#{mode.id}</strong></td>
                  <td>
                    <div className="mode-name-cell">{mode.name}</div>
                    {mode.slowHash ? <StatusPill tone="warning">slow</StatusPill> : null}
                  </td>
                  <td>{mode.category}</td>
                  <td>{mode.passwordMin}–{mode.passwordMax}</td>
                  <td><span className="mono-small">{mode.kernels.join(" · ")}</span></td>
                  <td><code>{mode.exampleHash.slice(0, 34)}{mode.exampleHash.length > 34 ? "…" : ""}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 150 ? <div className="table-more">仅显示前 150 项，使用搜索缩小范围。</div> : null}
        </div>
      </Section>
    </div>
  );
}
