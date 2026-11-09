import type { ButtonHTMLAttributes } from "react";

type Size = "default" | "sm" | "lg";

const sizes: Record<Size, string> = {
  default: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "h-12 px-8 text-lg",
};

export function Button({
  className = "",
  size = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none cursor-pointer ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
