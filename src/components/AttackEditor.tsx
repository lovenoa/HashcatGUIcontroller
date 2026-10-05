import { Plus, Trash2 } from "lucide-react";
import type { AttackMode, JobSpec, MaskSource, CandidateSource, RuleSource } from "../types";
import { ATTACK_MODE_LABELS, formatCount, maskKeyspace } from "../lib/commandCompiler";
import { Button, Field, InfoTip, NumberInput, PathInput, Select, TextInput } from "./ui";

const attackDescriptions: Record<AttackMode, string> = {
  0: "按顺序尝试词表，并可通过规则生成变体。",
  1: "把左右两个词表拼接成候选。",
  3: "按掩码定义的字符集和长度尝试候选。",
  6: "词表在前、掩码在后，适合追加年份或数字。",
  7: "掩码在前、词表在后，适合固定前缀。",
  9: "把哈希行与候选词表行一一对应。"
};

export function AttackEditor({
  job,
  onChange
}: {
  job: JobSpec;
  onChange: (next: JobSpec) => void;
}) {
  function updateAttack(patch: Partial<JobSpec["attack"]>) {
    onChange({ ...job, attack: { ...job.attack, ...patch } });
  }

  function updateCandidates(next: CandidateSource[]) {
    onChange({ ...job, candidateSources: next });
  }

  function updateRules(next: RuleSource[]) {
    onChange({ ...job, ruleSources: next });
  }

  function updateMasks(next: MaskSource[]) {
    onChange({ ...job, masks: next });
  }

  const candidateLabel = job.attackMode === 1 ? "组合词表" : job.attackMode === 9 ? "关联词表" : "词表 / 目录";
  const selectedMode = job.attackMode;

  return (
    <div className="attack-editor">
      <div className="attack-mode-strip">
        {([0, 1, 3, 6, 7, 9] as AttackMode[]).map((mode) => (
          <div key={mode} className={`attack-mode-option ${selectedMode === mode ? "active" : ""}`}>
            <button
              className="attack-mode-main"
              type="button"
              onClick={() => onChange({ ...job, attackMode: mode })}
            >
              <span className="mode-number">-a {mode}</span>
              <span className="mode-name">{ATTACK_MODE_LABELS[mode]}</span>
            </button>
            <InfoTip label="attackMode" />
          </div>
        ))}
      </div>

      <div className="attack-description">{attackDescriptions[selectedMode]}</div>

      {(selectedMode === 0 || selectedMode === 1 || selectedMode === 6 || selectedMode === 7 || selectedMode === 9) && (
        <div className="editor-block">
          <div className="editor-block-heading">
            <div>
              <strong>{candidateLabel}</strong>
              <small>候选来源按顺序传入 hashcat</small>
            </div>
            <Button
              variant="quiet"
              icon={<Plus size={14} />}
              onClick={() =>
                updateCandidates([
                  ...job.candidateSources,
                  { id: `candidate-${Date.now()}`, path: "", kind: "wordlist" }
                ])
              }
            >
              添加来源
            </Button>
          </div>
          <div className="repeat-list">
            {job.candidateSources.map((source, index) => (
              <div className="repeat-row" key={source.id}>
                <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
                <TextInput
                  value={source.path}
                  ariaLabel={`候选来源 ${index + 1}`}
                  placeholder="词表文件或目录路径"
                  onChange={(value) =>
                    updateCandidates(job.candidateSources.map((item) => (item.id === source.id ? { ...item, path: value } : item)))
                  }
                />
                <Select
                  value={source.kind}
                  ariaLabel="候选来源类型"
                  options={[
                    { value: "wordlist", label: "词表" },
                    { value: "directory", label: "目录" }
                  ]}
                  onChange={(value) =>
                    updateCandidates(
                      job.candidateSources.map((item) =>
                        item.id === source.id ? { ...item, kind: value as CandidateSource["kind"] } : item
                      )
                    )
                  }
                />
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label="删除候选来源"
                  onClick={() => updateCandidates(job.candidateSources.filter((item) => item.id !== source.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(selectedMode === 0 || selectedMode === 9) && (
        <div className="editor-block">
          <div className="editor-block-heading">
            <div>
              <strong>规则文件</strong>
              <small>7.1.2 中规则文件适用于 -a 0 和 -a 9</small>
            </div>
            <Button
              variant="quiet"
              icon={<Plus size={14} />}
              onClick={() => updateRules([...job.ruleSources, { id: `rule-${Date.now()}`, path: "" }])}
            >
              添加规则
            </Button>
          </div>
          <div className="repeat-list">
            {job.ruleSources.map((source, index) => (
              <div className="repeat-row" key={source.id}>
                <span className="row-index">R{index + 1}</span>
                <TextInput
                  value={source.path}
                  ariaLabel={`规则文件 ${index + 1}`}
                  placeholder="rules/best66.rule"
                  onChange={(value) =>
                    updateRules(job.ruleSources.map((item) => (item.id === source.id ? { ...item, path: value } : item)))
                  }
                />
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label="删除规则"
                  onClick={() => updateRules(job.ruleSources.filter((item) => item.id !== source.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="inline-fields">
            <Field label="左规则" guidance="rules">
              <TextInput value={job.attack.ruleLeft} onChange={(value) => updateAttack({ ruleLeft: value })} placeholder="-j，例如 c" />
            </Field>
            <Field label="右规则" guidance="rules">
              <TextInput value={job.attack.ruleRight} onChange={(value) => updateAttack({ ruleRight: value })} placeholder="-k，例如 ^-" />
            </Field>
            <Field label="随机规则数">
              <NumberInput value={job.attack.generateRules} onChange={(value) => updateAttack({ generateRules: value })} />
            </Field>
            <Field label="规则函数下限">
              <NumberInput value={job.attack.generateRulesFuncMin} onChange={(value) => updateAttack({ generateRulesFuncMin: value })} />
            </Field>
            <Field label="规则函数上限">
              <NumberInput value={job.attack.generateRulesFuncMax} onChange={(value) => updateAttack({ generateRulesFuncMax: value })} />
            </Field>
            <Field label="规则函数集">
              <TextInput value={job.attack.generateRulesFuncSel} onChange={(value) => updateAttack({ generateRulesFuncSel: value })} placeholder="例如 ioTlc" />
            </Field>
          </div>
        </div>
      )}

      {(selectedMode === 3 || selectedMode === 6 || selectedMode === 7) && (
        <div className="editor-block">
          <div className="editor-block-heading">
            <div>
              <strong>掩码候选</strong>
              <small>支持内置字符集、?1 至 ?8 和 .hcmask 文件</small>
            </div>
            <Button
              variant="quiet"
              icon={<Plus size={14} />}
              onClick={() => updateMasks([...job.masks, { id: `mask-${Date.now()}`, value: "", isFile: false }])}
            >
              添加掩码
            </Button>
          </div>
          <div className="repeat-list">
            {job.masks.map((mask, index) => (
              <div className="repeat-row" key={mask.id}>
                <span className="row-index">M{index + 1}</span>
                <TextInput
                  value={mask.value}
                  ariaLabel={`掩码 ${index + 1}`}
                  placeholder={mask.isFile ? "masks/example.hcmask" : "?u?l?l?l?l?d?d?d?d"}
                  onChange={(value) => updateMasks(job.masks.map((item) => (item.id === mask.id ? { ...item, value } : item)))}
                />
                <Select
                  value={mask.isFile ? "file" : "raw"}
                  ariaLabel="掩码类型"
                  options={[
                    { value: "raw", label: "掩码表达式" },
                    { value: "file", label: "掩码文件" }
                  ]}
                  onChange={(value) =>
                    updateMasks(job.masks.map((item) => (item.id === mask.id ? { ...item, isFile: value === "file" } : item)))
                  }
                />
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label="删除掩码"
                  onClick={() => updateMasks(job.masks.filter((item) => item.id !== mask.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="mask-summary">
            <div>
              <span>估算键空间</span>
              <strong>
                {formatCount(
                  job.masks
                    .filter((item) => !item.isFile && item.value.trim())
                    .reduce((total, item) => total + maskKeyspace(item.value, job.attack.customCharsets, job.attack.increment, job.attack.incrementMin, job.attack.incrementMax), 0)
                )}
              </strong>
            </div>
            <div>
              <span>长度递增</span>
              <Select
                value={job.attack.increment}
                options={[
                  { value: "none", label: "关闭" },
                  { value: "normal", label: "从左到右" },
                  { value: "inverse", label: "从右到左" }
                ]}
                onChange={(value) => updateAttack({ increment: value as JobSpec["attack"]["increment"] })}
              />
            </div>
            <Field label="最小长度">
              <NumberInput value={job.attack.incrementMin} onChange={(value) => updateAttack({ incrementMin: value })} />
            </Field>
            <Field label="最大长度">
              <NumberInput value={job.attack.incrementMax} onChange={(value) => updateAttack({ incrementMax: value })} />
            </Field>
          </div>

          <div className="custom-charset-grid">
            {job.attack.customCharsets.map((charset, index) => (
              <Field key={index} label={`?${index + 1} 自定义字符集`} guidance="customCharset">
                <TextInput
                  value={charset}
                  placeholder={index === 0 ? "?l?d" : "留空表示未定义"}
                  onChange={(value) =>
                    updateAttack({
                      customCharsets: job.attack.customCharsets.map((item, itemIndex) => (itemIndex === index ? value : item))
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      <div className="editor-block compact">
        <div className="editor-block-heading">
          <div>
            <strong>候选顺序与范围</strong>
            <small>用于大键空间任务的分布和快速检查</small>
          </div>
        </div>
        <div className="inline-fields">
          <Field label="Markov" guidance="markov">
            <Select
              value={job.attack.markovMode}
              options={[
                { value: "default", label: "默认" },
                { value: "disable", label: "关闭" },
                { value: "classic", label: "经典" },
                { value: "inverse", label: "反向" }
              ]}
              onChange={(value) => updateAttack({ markovMode: value as JobSpec["attack"]["markovMode"] })}
            />
          </Field>
          <Field label="Markov 阈值">
            <NumberInput value={job.attack.markovThreshold} onChange={(value) => updateAttack({ markovThreshold: value })} />
          </Field>
          <Field label="跳过候选">
            <NumberInput value={job.attack.skip} onChange={(value) => updateAttack({ skip: value })} />
          </Field>
          <Field label="限制数量">
            <NumberInput value={job.attack.limit} onChange={(value) => updateAttack({ limit: value })} />
          </Field>
        </div>
      </div>
    </div>
  );
}
