import { useRef, useEffect, useState, useCallback } from "react";
import SlimSelect from "slim-select";
import type { UseSelectOptions, UseSelectReturn, SelectOption } from "../types";

/**
 * Hook para usar Slim Select con React
 */
export function useSelect(options: UseSelectOptions = {}): UseSelectReturn {
  const ref = useRef<HTMLDivElement>(null);
  const selectRef = useRef<SlimSelect | null>(null);
  const [value, setValueState] = useState(options.defaultValue ?? "");
  const [values, setValuesState] = useState<string[]>(options.defaultValues ?? []);
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>(
    options.options ?? []
  );

  // Inicializar Slim Select
  useEffect(() => {
    if (!ref.current) return;

    // Crear elemento select
    const selectEl = document.createElement("select");
    if (options.defaultValues) {
      selectEl.multiple = true;
    }
    ref.current.appendChild(selectEl);

    // Inicializar Slim Select
    selectRef.current = new SlimSelect({
      select: selectEl,
      settings: {
        placeholderText: options.placeholder ?? "Selecciona...",
        searchPlaceholder: options.searchPlaceholder ?? "Buscar...",
        showSearch: options.searchable ?? true,
        closeOnSelect: options.closeOnSelect ?? true,
        disabled: options.disabled ?? false,
        maxValuesShown: options.maxSelected,
        minSelected: options.minSelected,
        allowDeselect: true,
      },
      data: selectOptions.map((opt) => ({
        value: opt.value,
        text: opt.text,
        disabled: opt.disabled,
        selected: opt.selected,
      })),
      events: {
        afterChange: (newVal) => {
          if (Array.isArray(newVal)) {
            const vals = newVal.map((v) => v.value);
            setValuesState(vals);
          } else {
            const single = newVal as unknown as { value?: any } | undefined;
            if (single && single.value !== undefined) setValueState(single.value);
          }
        },
      },
    });

    return () => {
      selectRef.current?.destroy();
    };
  }, []);

  // Actualizar opciones
  useEffect(() => {
    if (selectRef.current && selectOptions.length > 0) {
      selectRef.current.setData(
        selectOptions.map((opt) => ({
          value: opt.value,
          text: opt.text,
          disabled: opt.disabled,
          selected: opt.selected,
        }))
      );
    }
  }, [selectOptions]);

  // Métodos
  const setValue = useCallback((newValue: string) => {
    setValueState(newValue);
    selectRef.current?.setSelected(newValue);
  }, []);

  const setValues = useCallback((newValues: string[]) => {
    setValuesState(newValues);
    selectRef.current?.setSelected(newValues);
  }, []);

  const setOptions = useCallback((newOptions: SelectOption[]) => {
    setSelectOptions(newOptions);
  }, []);

  const open = useCallback(() => {
    selectRef.current?.open();
  }, []);

  const close = useCallback(() => {
    selectRef.current?.close();
  }, []);

  const destroy = useCallback(() => {
    selectRef.current?.destroy();
  }, []);

  return {
    ref: ref as React.RefObject<HTMLDivElement>,
    value,
    values,
    setValue,
    setValues,
    options: selectOptions,
    setOptions,
    open,
    close,
    destroy,
  };
}
