import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { HashModeInfo, HashModeSelection } from "../types";

export function HashModeCombobox({
  value,
  modes,
  onChange
}: {
  value: HashModeSelection;
  modes: HashModeInfo[];
  onChange: (value: HashModeSelection) => void;
}) {
  const selected = value === "auto" ? null : modes.find((mode) => mode.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return modes.slice(0, 40);
    return modes
      .filter((mode) =>
        String(mode.id).includes(needle) ||
        mode.name.toLowerCase().includes(needle) ||
        mode.category.toLowerCase().includes(needle)
      )
      .slice(0, 40);
  }, [modes, query]);

  function select(mode: HashModeSelection) {
    onChange(mode);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="hash-mode-combobox">
      <div className="combobox-control">
        <Search size={14} aria-hidden="true" />
        <input
          value={open ? query : selected ? `#${selected.id} · ${selected.name}` : "自动识别"}
          placeholder="输入 ID、名称或类别搜索"
          aria-label="搜索哈希模式"
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />
        <button type="button" className="icon-button subtle" aria-label="展开哈希模式" onClick={() => setOpen((current) => !current)}>
          <ChevronDown size={14} />
        </button>
      </div>

      {open ? (
        <div className="combobox-menu">
          <button type="button" className="combobox-option" onClick={() => select("auto")}>
            <strong>自动识别</strong>
            <small>让 hashcat 根据输入格式匹配</small>
          </button>
          {filtered.map((mode) => (
            <button type="button" className="combobox-option" key={mode.id} onClick={() => select(mode.id)}>
              <strong>#{mode.id} · {mode.name}</strong>
              <small>{mode.category} · {mode.passwordMin}–{mode.passwordMax} chars</small>
            </button>
          ))}
          {!filtered.length ? <div className="combobox-empty">没有匹配模式</div> : null}
        </div>
      ) : null}
    </div>
  );
}
