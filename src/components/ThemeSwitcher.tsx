import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils/cn';

interface ThemeSwitcherProps {
  className?: string;
}

function BaseThemeSwitcher({ className, compact }: ThemeSwitcherProps & { compact: boolean }) {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-[background-color,border-color,color,transform] duration-200 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] active:scale-[0.98]',
        compact ? 'h-10 w-10' : 'h-10 w-11',
        className
      )}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  return <BaseThemeSwitcher className={className} compact={false} />;
}

export function ThemeSwitcherCompact({ className }: ThemeSwitcherProps) {
  return <BaseThemeSwitcher className={className} compact />;
}
