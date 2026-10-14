import { useMemo } from "react";

import { Combobox } from "@/react-app/components/ui/combobox";
import { leafCategories, useReferenceData } from "@/react-app/hooks/use-reference-data";

/** Categorias selecionáveis (filhas + pais sem filhos) do tipo informado, com busca por pai ou filho. */
export function CategoryCombobox({
  kind,
  value,
  onValueChange,
  invalid,
  id,
}: {
  kind: "REVENUE" | "EXPENSE";
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  const categories = useReferenceData((s) => s.categories);
  const options = useMemo(
    () =>
      leafCategories(categories, kind).map((c) => ({
        value: String(c.id),
        label: c.label,
        keywords: c.parentName ? [c.parentName, c.name] : [c.name],
      })),
    [categories, kind]
  );

  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder="Selecione uma categoria"
      searchPlaceholder="Buscar categoria..."
      emptyText="Nenhuma categoria encontrada."
      aria-invalid={invalid}
    />
  );
}
