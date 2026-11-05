import pool from "../db.js";

/** Marca as rubricas criadas pelo assistente: é o que permite ao "desfazer" removê-las sem tocar nas do usuário. */
export const RUBRIC_NOTE = "Criada pelo assistente do WhatsApp";

/**
 * Cria a subcategoria (rubrica) dentro de uma categoria de topo do tenant, ou devolve a que já existe com o mesmo nome
 * (duas notas na mesma mensagem podem propor a mesma rubrica). null = a categoria-mãe não existe mais ou é de outro tipo.
 */
export const ensureRubric = async (
  tenantId: number,
  parentId: number,
  name: string,
  kind: "EXPENSE" | "REVENUE"
): Promise<{ id: number; created: boolean } | null> => {
  const parent = await pool.query("SELECT id FROM categories WHERE id = $1 AND tenant_id = $2 AND parent_id IS NULL AND kind = $3", [parentId, tenantId, kind]);
  if (!parent.rows[0]) return null;
  const dup = await pool.query("SELECT id FROM categories WHERE tenant_id = $1 AND parent_id = $2 AND kind = $3 AND lower(name) = lower($4) LIMIT 1", [tenantId, parentId, kind, name]);
  if (dup.rows[0]) return { id: dup.rows[0].id, created: false };
  const { rows } = await pool.query(
    "INSERT INTO categories (name, kind, notes, parent_id, tenant_id) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    [name, kind, RUBRIC_NOTE, parentId, tenantId]
  );
  return { id: rows[0].id, created: true };
};

/**
 * "Desfazer" um lançamento: se a categoria dele foi criada pelo assistente e ficou sem nenhum lançamento nem subcategoria
 * (e ninguém editou a observação), ela é removida. Devolve o nome removido, ou null se nada foi apagado.
 */
export const removeRubricIfUnused = async (tenantId: number, categoryId: number): Promise<string | null> => {
  const { rows } = await pool.query(
    `DELETE FROM categories
     WHERE id = $1 AND tenant_id = $2 AND parent_id IS NOT NULL AND notes = $3
       AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.category_id = $1)
       AND NOT EXISTS (SELECT 1 FROM categories s WHERE s.parent_id = $1)
     RETURNING name`,
    [categoryId, tenantId, RUBRIC_NOTE]
  );
  return rows[0]?.name ?? null;
};
