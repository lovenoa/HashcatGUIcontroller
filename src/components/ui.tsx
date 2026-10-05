import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Switch from "@radix-ui/react-switch";
import { ChevronDown, Info, UploadCloud } from "lucide-react";
import { guidanceFor } from "../lib/guidance";
import { acceptDroppedPath, registerPathDropTarget, setPathDropTarget } from "../lib/dragDrop";

const PATH_PLACEHOLDER = /(路径|文件|目录|\.rule|\.hcmask|\.hckmap|restore|插件|动态库|recovered|good\.log|inducts)/i;

export function InfoTip({ label }: { label: string }) {
  const guidance = guidanceFor(label);
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button className="icon-button subtle" type="button" aria-label={guidance.short}>
          <Info size={14} strokeWidth={1.8} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" side="top" sideOffset={8} collisionPadding={12}>
          <strong>{guidance.short}</strong>
          <span>{guidance.detail}</span>
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Field({
  label,
  hint,
  guidance,
  children,
  wide = false
}: {
  label: string;
  hint?: string;
  guidance?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""}`}>
      <span className="field-label">
        <span>{label}</span>
        {guidance ? <InfoTip label={guidance} /> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Section({
  eyebrow,
  title,
  description,
  action,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="section-action">{action}</div> : null}
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  ariaLabel,
  path = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  ariaLabel?: string;
  path?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptsPath = path || PATH_PLACEHOLDER.test(placeholder || "");

  useEffect(() => {
    if (!acceptsPath || !inputRef.current) return;
    return registerPathDropTarget(inputRef.current, onChange);
  }, [acceptsPath, onChange]);

  return (
    <div className={`text-input-shell ${acceptsPath ? "path-drop" : ""} ${dragging ? "dragging" : ""}`}>
      <input
        ref={inputRef}
        className="text-input"
        value={value}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        onDragOver={acceptsPath ? (event) => {
          event.preventDefault();
          if (inputRef.current) setPathDropTarget(inputRef.current, onChange);
          setDragging(true);
        } : undefined}
        onDragLeave={acceptsPath ? () => {
          setDragging(false);
          setPathDropTarget(null);
        } : undefined}
        onDrop={acceptsPath ? (event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (!file) return;
          const path = (file as File & { path?: string }).path || file.name;
          acceptDroppedPath(path, { x: event.clientX * (window.devicePixelRatio || 1), y: event.clientY * (window.devicePixelRatio || 1) });
        } : undefined}
      />
      {acceptsPath ? <UploadCloud size={14} aria-hidden="true" /> : null}
    </div>
  );
}

export function PathInput(props: Omit<Parameters<typeof TextInput>[0], "path">) {
  return <TextInput {...props} path />;
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  disabled = false
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <input
      className="text-input"
      type="number"
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : 0}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled = false,
  ariaLabel
}: {
  value: string | number;
  onChange: (value: string) => void;
  options: Array<{ value: string | number; label: string }>;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="select-wrap">
      <select
        className="select-input"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        {description ? <small>{description}</small> : null}
      </div>
      <Switch.Root
        className="switch"
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      >
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  icon,
  disabled = false,
  type = "button"
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "quiet";
  icon?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button className={`button ${variant}`} type={type} onClick={onClick} disabled={disabled}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function StatusPill({ tone, children }: { tone: "neutral" | "success" | "warning" | "danger"; children: ReactNode }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}
