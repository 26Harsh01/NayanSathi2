import React from 'react';
import { useAppState } from '../../context/AppStateContext';

export interface GazeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  gazeId: string;
  gazeLabel?: string;
  variant?: 'default' | 'primary' | 'danger' | 'subtle' | 'selected';
  sizeOverride?: 'standard' | 'large' | 'xlarge';
  children: React.ReactNode;
}

export const GazeButton: React.FC<GazeButtonProps> = ({
  gazeId,
  gazeLabel,
  variant = 'default',
  sizeOverride,
  className = '',
  children,
  ...rest
}) => {
  const { settings } = useAppState();
  const effectiveSize = sizeOverride ?? settings.interface.buttonSize;
  const hc = settings.interface.highContrast;

  const sizeClasses =
    effectiveSize === 'xlarge'
      ? 'min-h-[84px] px-6 py-4 text-lg'
      : effectiveSize === 'large'
        ? 'min-h-[60px] px-5 py-3 text-base'
        : 'min-h-[48px] px-4 py-2.5 text-sm';

  const variantClasses =
    variant === 'primary'
      ? 'bg-teal-700 text-white border-teal-800 dark:bg-teal-600 dark:border-teal-500'
      : variant === 'danger'
        ? 'bg-red-700 text-white border-red-900 dark:bg-red-600 dark:border-red-500'
        : variant === 'selected'
          ? 'bg-slate-900 text-white border-slate-900 dark:bg-teal-600 dark:border-teal-500'
          : variant === 'subtle'
            ? 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
            : 'bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700';

  const hcClasses = hc ? 'border-2 font-semibold shadow-none' : 'border shadow-xs';

  return (
    <button
      type="button"
      data-gaze-target={gazeId}
      data-gaze-label={gazeLabel}
      className={`relative rounded-xl font-medium select-none cursor-pointer flex items-center justify-center gap-2.5 text-center leading-snug disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${hcClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
