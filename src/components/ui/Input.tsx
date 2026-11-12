import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Contenido interactivo a la derecha (ej: botón mostrar contraseña). A diferencia de
      rightIcon, sí recibe clics. */
  rightAction?: ReactNode;
  error?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = "",
      label,
      leftIcon,
      rightIcon,
      rightAction,
      error = false,
      fullWidth = true,
      type = "text",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "py-2.5 border bg-bg-100 text-text-100 placeholder-text-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition rounded-lg";

    const errorStyles = error
      ? "border-red-500 focus:ring-red-500"
      : "border-border";

    const widthStyles = fullWidth ? "w-full" : "";

    const paddingStyles = [
      leftIcon ? "pl-10" : "pl-3",
      rightAction ? "pr-11" : rightIcon ? "pr-10" : "pr-3",
    ].join(" ");

    const field = leftIcon || rightIcon || rightAction ? (
      <div className={`relative ${fullWidth ? "w-full" : ""}`}>
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="h-5 w-5 text-text-100">{leftIcon}</span>
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={`block ${widthStyles} ${paddingStyles} ${baseStyles} ${errorStyles} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="h-5 w-5 text-text-100">{rightIcon}</span>
          </div>
        )}
        {rightAction && (
          <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
            {rightAction}
          </div>
        )}
      </div>
    ) : (
      <input
        ref={ref}
        type={type}
        className={`block ${widthStyles} ${paddingStyles} ${baseStyles} ${errorStyles} ${className}`}
        {...props}
      />
    );

    if (!label) return field;

    return (
      <div className={fullWidth ? "w-full" : ""}>
        <span className="block text-xs font-medium text-text-200 mb-1">{label}</span>
        {field}
      </div>
    );
  }
);

Input.displayName = "Input";
