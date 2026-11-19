import { database, type DB } from "./db";
import { price, defaultRule } from "./pricing";
export type CatalogProduct = {
  id: string;
  group_key: string;
  variant_label: string;
  supplier_id: string;
  category_id: string;
  name: string;
  description: string;
  brand: string;
  image: string;
  stock: number;
  seller: string;
  price: number;
  original: number;
  available: boolean;
  demo: boolean;
  cost_kobo?: number;
  supplier_due_kobo?: number;
};
export async function catalog(
  db?: DB,
  internal = false,
): Promise<CatalogProduct[]> {
  db ??= await database();
  const products = (
    await db.query(
      `SELECT p.*,s.name AS seller,s.commission_bps FROM products p JOIN suppliers s ON s.id=p.supplier_id WHERE p.active=TRUE AND s.status='approved' ORDER BY p.created_at DESC,p.id`,
    )
  ).rows;
  const rules = (await db.query("SELECT * FROM pricing_rules")).rows;
  return products.map((p: any) => {
    const rule =
      rules.find((r) => r.category_id === p.category_id) ??
      rules.find((r) => r.id === "default") ??
      defaultRule;
    const quote = price(p.cost_kobo, rule as any, p.commission_bps);
    const { cost_kobo, commission_bps, ...publicProduct } = p;
    return {
      ...publicProduct,
      ...(internal
        ? { cost_kobo, commission_bps, supplier_due_kobo: quote.supplierDue }
        : {}),
      price: quote.selling,
      original: quote.original,
      available: quote.sellable && p.stock > 0,
      demo: true,
    };
  });
}
