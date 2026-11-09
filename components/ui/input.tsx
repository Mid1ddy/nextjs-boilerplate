import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full font-semibold text-stone-800 bg-white outline-none placeholder:text-stone-400 ${className}`}
      {...props}
    />
  );
}
