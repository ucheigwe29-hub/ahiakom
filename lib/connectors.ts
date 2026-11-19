import { database, audit } from "./db";
export interface SupplierConnector {
  name: string;
  submit(input: {
    fulfilmentId: string;
    orderId: string;
  }): Promise<{ externalId: string }>;
}
export const direct: SupplierConnector = {
  name: "direct",
  async submit(input) {
    return { externalId: input.fulfilmentId };
  },
};
export const simulated: SupplierConnector = {
  name: "simulated",
  async submit(input) {
    return { externalId: "SIM-" + input.fulfilmentId };
  },
};
export async function dispatchOutbox(actor: string) {
  const db = await database();
  return db.transaction(async (tx) => {
    const jobs = (
      await tx.query(
        "SELECT j.*,f.order_id,s.connector FROM outbox j JOIN fulfilments f ON f.id=j.fulfilment_id JOIN suppliers s ON s.id=f.supplier_id WHERE j.status IN ('pending','retry') AND j.available_at<=NOW() ORDER BY j.id FOR UPDATE OF j SKIP LOCKED LIMIT 25",
      )
    ).rows;
    let sent = 0;
    for (const j of jobs) {
      try {
        const c =
          j.connector === "direct"
            ? direct
            : j.connector === "simulated"
              ? simulated
              : null;
        if (!c) throw new Error("Connector not approved");
        await c.submit({ fulfilmentId: j.fulfilment_id, orderId: j.order_id });
        await tx.query(
          "UPDATE outbox SET status='sent',attempts=attempts+1 WHERE id=$1",
          [j.id],
        );
        sent++;
      } catch {
        await tx.query(
          "UPDATE outbox SET status=$1,attempts=attempts+1,last_error='Connector unavailable',available_at=NOW()+INTERVAL '5 minutes' WHERE id=$2",
          [j.attempts >= 4 ? "failed" : "retry", j.id],
        );
      }
    }
    await audit(tx, actor, "outbox.dispatched", String(sent));
    return { sent };
  });
}
