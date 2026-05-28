import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | undefined;
  helperText?: string | undefined;
};

export function Input({
  label,
  error,
  helperText,
  className,
  ...props
}: Props) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={cn(
          "w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors bg-white",
          "placeholder:text-gray-400 disabled:bg-surface-100 disabled:cursor-not-allowed",
          error
            ? "border-red-300 focus:border-red-400 bg-red-50"
            : "border-surface-200 focus:border-primary",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-gray-400">{helperText}</p>
      )}
    </div>
  );
}
