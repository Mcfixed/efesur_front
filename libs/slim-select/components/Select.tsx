import { useEffect, useRef, useId } from "react";
import SlimSelect from "slim-select";
import type { SelectProps } from "../types";
import "../styles/slim-select.css";

/**
 * Componente Select simple
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Selecciona...",
  searchable = true,
  searchPlaceholder = "Buscar...",
  closeOnSelect = true,
  disabled = false,
  className = "",
  id,
  name,
}: SelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const slimRef = useRef<SlimSelect | null>(null);
  const generatedId = useId();
  const selectId = id ?? generatedId;

  // Inicializar
  useEffect(() => {
    if (!selectRef.current) return;

    slimRef.current = new SlimSelect({
      select: selectRef.current,
      settings: {
        placeholderText: placeholder,
        searchPlaceholder,
        showSearch: searchable,
        closeOnSelect,
        disabled,
        allowDeselect: true,
      },
      events: {
        afterChange: (newVal) => {
          if (newVal.length > 0 && onChange) {
            onChange(newVal[0].value);
          }
        },
      },
    });

    return () => {
      slimRef.current?.destroy();
    };
  }, []);

  // Actualizar opciones
  useEffect(() => {
    if (slimRef.current) {
      slimRef.current.setData(
        options.map((opt) => ({
          value: opt.value,
          text: opt.text,
          disabled: opt.disabled,
          selected: opt.value === value,
        }))
      );
    }
  }, [options, value]);

  // Actualizar valor
  useEffect(() => {
    if (slimRef.current && value !== undefined) {
      slimRef.current.setSelected(value);
    }
  }, [value]);

  // Actualizar disabled
  useEffect(() => {
    if (slimRef.current) {
      if (disabled) {
        slimRef.current.disable();
      } else {
        slimRef.current.enable();
      }
    }
  }, [disabled]);

  return (
    <select
      ref={selectRef}
      id={selectId}
      name={name}
      className={className}
      defaultValue={value}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.text}
        </option>
      ))}
    </select>
  );
}
