import type { ReactNode } from 'react';
import { Badge } from './Badge';
import { Switch } from './Switch';

interface SettingToggleProps {
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: ReactNode;
  extra?: ReactNode;
  enabledLabel?: string;
  disabledLabel?: string;
}

export function SettingToggle({
  title,
  hint,
  checked,
  onCheckedChange,
  disabled,
  icon,
  extra,
  enabledLabel = 'Enabled',
  disabledLabel = 'Disabled',
}: SettingToggleProps) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[var(--color-surface-2)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{hint}</p>
        </div>

        <div className="shrink-0">
          <Switch
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
            aria-label={title}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {icon}
        <Badge variant={checked ? 'success' : 'default'}>
          {checked ? enabledLabel : disabledLabel}
        </Badge>
      </div>

      {extra ? <div className="mt-3">{extra}</div> : null}
    </div>
  );
}
