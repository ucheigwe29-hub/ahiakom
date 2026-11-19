import { database, audit, type DB } from "./db";
import { catalog } from "./catalog";
import { HttpError, digest, type User } from "./auth";
import { feeEstimate } from "./pricing";
export type Basket = { productId: string; quantity: number }[];
export async function createOrder(
  user: User,
  items: Basket,
  address: Record<string, string>,
  key: string,
) {
  const db = await database();
  const requestHash = digest(
    JSON.stringify({
      items: [...items].sort((a, b) => a.productId.localeCompare(b.productId)),
      address,
    }),
  );
  return db.transaction(async (tx) => {
    // Serialize duplicate requests for this customer; stock updates are atomic across customers.
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [user.id]);
    const prior = (
      await tx.query(
        "SELECT * FROM orders WHERE user_id=$1 AND idempotency_key=$2",
        [user.id, key],
      )
    ).rows[0];
    if (prior) {
      if (prior.request_hash !== requestHash)
        throw new HttpError(
          409,
          "This checkout key belongs to a different basket",
        );
      return prior;
    }
    const products = await catalog(tx, true);
    const lines = items.map((i) => {
      const p = products.find((p) => p.id === i.productId);
      if (!p || !p.available)
        throw new HttpError(409, "A product is no longer available");
      return { ...i, p };
    });
    if (new Set(items.map((i) => i.productId)).size !== items.length)
      throw new HttpError(400, "Duplicate basket lines");
    const supplierIds = [...new Set(lines.map((l) => l.p.supplier_id))];
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.quantity, 0);
    const shipping = 250000 * supplierIds.length;
    if (subtotal + shipping > 200000000)
      throw new HttpError(400, "Order exceeds demonstration limit");
    const id = "AH-" + crypto.randomUUID();
    await tx.query(
      "INSERT INTO orders(id,user_id,idempotency_key,request_hash,subtotal_kobo,shipping_kobo,total_kobo,address) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        user.id,
        key,
        requestHash,
        subtotal,
        shipping,
        subtotal + shipping,
        JSON.stringify(address),
      ],
    );
    for (const { p, quantity } of [...lines].sort((a, b) =>
      a.p.id.localeCompare(b.p.id),
    )) {
      const updated = await tx.query(
        "UPDATE products SET stock=stock-$1 WHERE id=$2 AND stock>=$1 RETURNING id",
        [quantity, p.id],
      );
      if (!updated.rows.length)
        throw new HttpError(
          409,
          `${p.name} has insufficient demonstration stock`,
        );
      await tx.query(
        "INSERT INTO order_items VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          crypto.randomUUID(),
          id,
          p.id,
          p.supplier_id,
          p.name,
          quantity,
          p.cost_kobo,
          p.price,
          p.supplier_due_kobo,
        ],
      );
    }
    for (const sid of supplierIds)
      await tx.query(
        "INSERT INTO fulfilments(id,order_id,supplier_id) VALUES($1,$2,$3)",
        [crypto.randomUUID(), id, sid],
      );
    const provider =
      process.env.PAYMENT_MODE === "paystack" ? "paystack" : "simulated";
    await tx.query(
      "INSERT INTO payments(reference,order_id,provider,amount_kobo) VALUES($1,$2,$3,$4)",
      ["AK-" + crypto.randomUUID(), id, provider, subtotal + shipping],
    );
    await audit(tx, user.id, "order.created", id);
    return (await tx.query("SELECT * FROM orders WHERE id=$1", [id])).rows[0];
  });
}
export async function confirmPayment(
  reference: string,
  amount: number,
  currency: string,
  providerId: string,
  provider: string,
  fees = 0,
) {
  const db = await database();
  return db.transaction(async (tx) => {
    const pay = (
      await tx.query("SELECT * FROM payments WHERE reference=$1 FOR UPDATE", [
        reference,
      ])
    ).rows[0];
    if (!pay) throw new HttpError(404, "Payment not found");
    if (
      pay.amount_kobo !== amount ||
      currency !== "NGN" ||
      pay.provider !== provider
    )
      throw new HttpError(409, "Payment reconciliation mismatch");
    if (pay.status === "success") return { duplicate: true };
    const order = (
      await tx.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        pay.order_id,
      ])
    ).rows[0];
    if (order.status !== "pending_payment") {
      await tx.query(
        "UPDATE payments SET status='exception',provider_id=$1,verified_at=NOW() WHERE reference=$2",
        [providerId, reference],
      );
      await audit(tx, undefined, "payment.late_requires_refund", order.id);
      return { exception: true };
    }
    await tx.query(
      "UPDATE payments SET status='success',provider_id=$1,fees_kobo=$2,verified_at=NOW() WHERE reference=$3",
      [providerId, fees, reference],
    );
    await tx.query("UPDATE orders SET status='awaiting_supplier' WHERE id=$1", [
      order.id,
    ]);
    await tx.query(
      "UPDATE fulfilments SET status='awaiting_supplier' WHERE order_id=$1",
      [order.id],
    );
    const fs = (
      await tx.query("SELECT id FROM fulfilments WHERE order_id=$1", [order.id])
    ).rows;
    for (const f of fs)
      await tx.query(
        "INSERT INTO outbox(id,fulfilment_id) VALUES($1,$2) ON CONFLICT(fulfilment_id) DO NOTHING",
        [crypto.randomUUID(), f.id],
      );
    await tx.query("DELETE FROM cart WHERE user_id=$1", [order.user_id]);
    await audit(tx, order.user_id, "payment.verified", order.id);
    return { duplicate: false };
  });
}
export async function cancelOrder(user: User, id: string) {
  const db = await database();
  return db.transaction(async (tx) => {
    const order = (
      await tx.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!order || (order.user_id !== user.id && user.role !== "admin"))
      throw new HttpError(404, "Order not found");
    if (order.status === "cancelled") return;
    if (order.status !== "pending_payment")
      throw new HttpError(409, "Paid orders require a refund request");
    const items = (
      await tx.query("SELECT * FROM order_items WHERE order_id=$1", [id])
    ).rows;
    for (const i of items)
      await tx.query("UPDATE products SET stock=stock+$1 WHERE id=$2", [
        i.quantity,
        i.product_id,
      ]);
    await tx.query("UPDATE orders SET status='cancelled' WHERE id=$1", [id]);
    await tx.query(
      "UPDATE fulfilments SET status='cancelled' WHERE order_id=$1",
      [id],
    );
    await audit(tx, user.id, "order.cancelled", id);
  });
}
export async function getOrders(user: User) {
  const db = await database();
  const os = (
    await db.query(
      "SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC",
      [user.id],
    )
  ).rows;
  for (const o of os) {
    o.items = (
      await db.query(
        "SELECT id,name,quantity,price_kobo FROM order_items WHERE order_id=$1",
        [o.id],
      )
    ).rows;
    o.fulfilments = (
      await db.query(
        "SELECT f.id,f.status,f.tracking,s.name AS seller FROM fulfilments f JOIN suppliers s ON s.id=f.supplier_id WHERE f.order_id=$1",
        [o.id],
      )
    ).rows;
    o.payment = (
      await db.query(
        "SELECT reference,provider,status,amount_kobo FROM payments WHERE order_id=$1",
        [o.id],
      )
    ).rows[0];
    o.returns = (
      await db.query(
        "SELECT id,status,note FROM return_requests WHERE order_id=$1",
        [o.id],
      )
    ).rows;
    o.refunds = (
      await db.query(
        "SELECT id,amount_kobo,status FROM refunds WHERE order_id=$1",
        [o.id],
      )
    ).rows;
  }
  return os;
}
export async function demoPay(user: User, id: string) {
  if (
    process.env.ENABLE_DEMO_PAYMENTS !== "true" ||
    process.env.PAYMENT_MODE === "paystack"
  )
    throw new HttpError(403, "Simulated payments disabled");
  const db = await database();
  const p = (
    await db.query(
      "SELECT p.* FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.id=$1 AND o.user_id=$2",
      [id, user.id],
    )
  ).rows[0];
  if (!p) throw new HttpError(404, "Order not found");
  return confirmPayment(
    p.reference,
    p.amount_kobo,
    "NGN",
    "SIM-" + p.reference,
    "simulated",
    feeEstimate(p.amount_kobo),
  );
}
