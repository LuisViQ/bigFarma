import React, { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export function Button({
  isLoading,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className="w-full h-12.5 mt-2.5 rounded-lg bg-[#007AFF] text-white text-lg font-bold cursor-pointer transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
      disabled={isLoading || disabled}
      {...rest}
    >
      {isLoading ? "Entrando..." : children}
    </button>
  );
}
