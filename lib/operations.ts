import { database, audit } from "./db";
import { HttpError, type User } from "./auth";
import { cancelOrder } from "./orders";
export async function expireReservations(actor: User) {
  const db = await database();
  const expired = (
    await db.query(
      "SELECT id FROM orders WHERE status='pending_payment' AND created_at<NOW()-INTERVAL '30 minutes' LIMIT 100",
    )
  ).rows;
  let count = 0;
  for (const o of expired) {
    try {
      await cancelOrder(actor, o.id);
      count++;
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 409)) throw e;
    }
  }
  return { expired: count };
}
export async function settlementReport(supplierId?: string) {
  const db = await database();
  return (
    await db.query(
      `SELECT f.id,f.order_id,f.supplier_id,s.name AS supplier,f.status,COALESCE(SUM(i.supplier_due_kobo*i.quantity),0)::bigint AS amount_kobo,st.provider_reference,st.status AS settlement_status,(EXISTS(SELECT 1 FROM refunds r WHERE r.order_id=f.order_id AND r.status<>'rejected') OR EXISTS(SELECT 1 FROM return_requests r WHERE r.order_id=f.order_id AND r.status<>'rejected')) AS refund_hold FROM fulfilments f JOIN suppliers s ON s.id=f.supplier_id JOIN order_items i ON i.order_id=f.order_id AND i.supplier_id=f.supplier_id JOIN payments p ON p.order_id=f.order_id LEFT JOIN settlements st ON st.fulfilment_id=f.id WHERE p.status='success' AND ($1::text IS NULL OR f.supplier_id=$1) GROUP BY f.id,s.name,st.provider_reference,st.status ORDER BY f.id`,
      [supplierId ?? null],
    )
  ).rows;
}
export async function simulateSettlement(actor: User, fulfilmentId: string) {
  if (
    process.env.ENABLE_DEMO_PAYMENTS !== "true" ||
    process.env.PAYMENT_MODE === "paystack"
  )
    throw new HttpError(403, "Simulated settlements disabled");
  const db = await database();
  return db.transaction(async (tx) => {
    const info = (
      await tx.query("SELECT order_id FROM fulfilments WHERE id=$1", [
        fulfilmentId,
      ])
    ).rows[0];
    if (!info) throw new HttpError(404, "Fulfilment not found");
    await tx.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [
      info.order_id,
    ]);
    const f = (
      await tx.query("SELECT * FROM fulfilments WHERE id=$1 FOR UPDATE", [
        fulfilmentId,
      ])
    ).rows[0];
    if (f.status !== "delivered")
      throw new HttpError(409, "Delivery must be completed first");
    const p = (
      await tx.query("SELECT * FROM payments WHERE order_id=$1", [f.order_id])
    ).rows[0];
    if (p.provider !== "simulated" || p.status !== "success")
      throw new HttpError(
        409,
        "Only successful simulated payments are eligible",
      );
    if (
      (
        await tx.query(
          "SELECT id FROM refunds WHERE order_id=$1 AND status<>'rejected'",
          [f.order_id],
        )
      ).rows.length
    )
      throw new HttpError(
        409,
        "Refund hold: supplier adjustments must be reviewed",
      );
    if (
      (
        await tx.query(
          "SELECT id FROM return_requests WHERE order_id=$1 AND status<>'rejected'",
          [f.order_id],
        )
      ).rows.length
    )
      throw new HttpError(
        409,
        "Return hold: supplier adjustments must be reviewed",
      );
    const prior = (
      await tx.query("SELECT * FROM settlements WHERE fulfilment_id=$1", [f.id])
    ).rows[0];
    if (prior) return prior;
    const amount = (
      await tx.query(
        "SELECT SUM(supplier_due_kobo*quantity)::int AS amount FROM order_items WHERE order_id=$1 AND supplier_id=$2",
        [f.order_id, f.supplier_id],
      )
    ).rows[0].amount;
    const id = crypto.randomUUID();
    await tx.query(
      "INSERT INTO settlements(id,fulfilment_id,supplier_id,amount_kobo,provider_reference) VALUES($1,$2,$3,$4,$5)",
      [id, f.id, f.supplier_id, amount, "SIM-SETTLE-" + id],
    );
    await audit(tx, actor.id, "settlement.simulated", id);
    return { id, amount_kobo: amount };
  });
}
export interface FinanceRow {
  id: string;
  status: string;
  subtotal_kobo: number;
  shipping_kobo: number;
  total_kobo: number;
  fees_kobo: number;
  provider: string;
  costs_reviewed: boolean;
  delivery_cost_kobo: number;
  tax_kobo: number;
  other_kobo: number;
  supplier_cost_kobo: string | number;
  supplier_due_kobo: string | number;
  refunded_kobo: string | number;
}
export async function financeReport() {
  const db = await database();
  const rows = (
    await db.query<FinanceRow>(
      `SELECT o.id,o.status,o.subtotal_kobo,o.shipping_kobo,o.total_kobo,p.fees_kobo,p.provider,c.order_id IS NOT NULL AS costs_reviewed,COALESCE(c.shipping_kobo,0) AS delivery_cost_kobo,COALESCE(c.tax_kobo,0) AS tax_kobo,COALESCE(c.other_kobo,0) AS other_kobo,COALESCE((SELECT SUM(i.cost_kobo*i.quantity) FROM order_items i WHERE i.order_id=o.id),0)::bigint AS supplier_cost_kobo,COALESCE((SELECT SUM(i.supplier_due_kobo*i.quantity) FROM order_items i WHERE i.order_id=o.id),0)::bigint AS supplier_due_kobo,COALESCE((SELECT SUM(r.amount_kobo) FROM refunds r WHERE r.order_id=o.id AND r.status='processed'),0)::bigint AS refunded_kobo FROM orders o JOIN payments p ON p.order_id=o.id LEFT JOIN order_costs c ON c.order_id=o.id WHERE p.status='success' ORDER BY o.created_at DESC`,
    )
  ).rows;
  return rows.map((r) => ({
    ...r,
    gross_markup_kobo: r.subtotal_kobo - Number(r.supplier_cost_kobo),
    contribution_kobo:
      r.total_kobo -
      Number(r.supplier_due_kobo) -
      r.fees_kobo -
      r.delivery_cost_kobo -
      r.tax_kobo -
      r.other_kobo -
      Number(r.refunded_kobo),
  }));
}
