import { useEffect, useRef, useId } from "react";
import SlimSelect from "slim-select";
import type { MultiSelectProps } from "../types";
import "../styles/slim-select.css";

/**
 * Componente Multi Select
 */
export function MultiSelect({
  values = [],
  onChange,
  options,
  placeholder = "Selecciona...",
  searchable = true,
  searchPlaceholder = "Buscar...",
  closeOnSelect = false,
  disabled = false,
  maxSelected,
  className = "",
  id,
  name,
}: MultiSelectProps) {
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
        maxValuesShown: maxSelected,
      },
      events: {
        afterChange: (newVal) => {
          if (onChange) {
            onChange(newVal.map((v) => v.value));
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
          selected: values.includes(opt.value),
        }))
      );
    }
  }, [options]);

  // Actualizar valores
  useEffect(() => {
    if (slimRef.current && values.length >= 0) {
      slimRef.current.setSelected(values);
    }
  }, [values]);

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
      multiple
      defaultValue={values}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.text}
        </option>
      ))}
    </select>
  );
}
