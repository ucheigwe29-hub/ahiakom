import {
  expireReservations,
  settlementReport,
  simulateSettlement,
  financeReport,
} from "@/lib/operations";
import { NextResponse } from "next/server";
import { z } from "zod";
import { database, audit } from "@/lib/db";
import { catalog } from "@/lib/catalog";
import {
  currentUser,
  requireUser,
  checkOrigin,
  rateLimit,
  HttpError,
  hashPassword,
  checkPassword,
  session,
  digest,
} from "@/lib/auth";
import { createOrder, getOrders, cancelOrder, demoPay } from "@/lib/orders";
import { paystack, reconcile, webhook } from "@/lib/paystack";
import { dispatchOutbox } from "@/lib/connectors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const accountSchema = z.object({
  email: z
    .email()
    .max(200)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(80),
});
const itemsSchema = z
  .array(
    z.object({
      productId: z.string().min(1).max(100),
      quantity: z.number().int().min(1).max(20),
    }),
  )
  .min(1)
  .max(50);
const addressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^\+?[0-9 ()-]{10,20}$/),
  address: z.string().trim().min(5).max(250),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
});
const productSchema = z.object({
  group_key: z.string().max(80).default(""),
  variant_label: z.string().max(80).default(""),
  name: z.string().trim().min(3).max(150),
  description: z.string().min(10).max(3000),
  category_id: z.string().max(50),
  cost_kobo: z.number().int().min(100).max(100000000),
  stock: z.number().int().min(0).max(100000),
  image: z
    .enum([
      "/products/headphones.svg",
      "/products/phone.svg",
      "/products/laptop.svg",
      "/products/blender.svg",
      "/products/watch.svg",
      "/products/sneakers.svg",
      "/products/beauty.svg",
      "/products/speaker.svg",
      "/products/bag.svg",
      "/products/dumbbell.svg",
      "/products/lamp.svg",
      "/products/bottle.svg",
    ])
    .default("/products/bag.svg"),
});
async function body(req: Request) {
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 200000)
    throw new HttpError(413, "Request too large");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
async function supplier(req: Request) {
  const user = await requireUser(req, ["supplier"]);
  const db = await database();
  const s = (
    await db.query("SELECT * FROM suppliers WHERE user_id=$1", [user.id])
  ).rows[0];
  if (!s) throw new HttpError(404, "Supplier profile missing");
  return { user, s, db };
}
async function handle(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/");
    if (path === "payments/webhook" && req.method === "POST")
      return NextResponse.json(await webhook(req));
    checkOrigin(req);
    const db = await database();
    const url = new URL(req.url);
    const method = req.method;
    if (path === "health")
      return NextResponse.json({
        status: "ok",
        database: (await db.query("SELECT 1")).rows.length === 1,
        paymentMode: process.env.PAYMENT_MODE ?? "simulated",
      });
    if (path === "catalog" && method === "GET") {
      let products = await catalog();
      const q = (url.searchParams.get("q") ?? "").toLowerCase(),
        cat = url.searchParams.get("category");
      products = products.filter(
        (p) =>
          (!q || (p.name + " " + p.seller).toLowerCase().includes(q)) &&
          (!cat || p.category_id === cat),
      );
      const sort = url.searchParams.get("sort");
      if (sort === "price-asc") products.sort((a, b) => a.price - b.price);
      if (sort === "price-desc") products.sort((a, b) => b.price - a.price);
      const total = products.length;
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      return NextResponse.json({
        products: products.slice((page - 1) * 12, page * 12),
        total,
        categories: (await db.query("SELECT * FROM categories ORDER BY name"))
          .rows,
      });
    }
    if (path === "auth/me")
      return NextResponse.json({ user: await currentUser(req) });
    if (["auth/register", "auth/login"].includes(path) && method === "POST") {
      const data = await body(req);
      const email = z.email().parse(data.email).toLowerCase();
      await rateLimit("auth:" + digest(email), 12);
      let user: any;
      if (path === "auth/register") {
        const d = accountSchema.parse(data);
        const id = crypto.randomUUID();
        try {
          await db.query(
            "INSERT INTO users(id,email,name,password,role) VALUES($1,$2,$3,$4,'customer')",
            [id, d.email, d.name, await hashPassword(d.password)],
          );
        } catch (e: any) {
          if (e.code === "23505")
            throw new HttpError(409, "Account unavailable. Try signing in.");
          throw e;
        }
        user = { id, email: d.email, name: d.name, role: "customer" };
      } else {
        const password = z.string().min(1).max(128).parse(data.password);
        const found = (
          await db.query("SELECT * FROM users WHERE email=$1", [email])
        ).rows[0];
        const valid = await checkPassword(
          password,
          found?.password ?? (await hashPassword("dummy-password-constant")),
        );
        if (!found || !valid)
          throw new HttpError(401, "Email or password is incorrect");
        const { password: _, ...safe } = found;
        user = safe;
      }
      const token = await session(db, user.id);
      const res = NextResponse.json({ user });
      res.cookies.set("ahiakom_session", token, {
        httpOnly: true,
        secure:
          new URL(process.env.APP_ORIGIN ?? req.url).protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 604800,
      });
      return res;
    }
    if (path === "auth/logout" && method === "POST") {
      const token = req.headers
        .get("cookie")
        ?.match(/ahiakom_session=([^;]+)/)?.[1];
      if (token)
        await db.query("DELETE FROM sessions WHERE token_hash=$1", [
          digest(token),
        ]);
      const res = NextResponse.json({ ok: true });
      res.cookies.set("ahiakom_session", "", { path: "/", maxAge: 0 });
      return res;
    }
    if (path === "cart") {
      const u = await requireUser(req);
      if (method === "PUT") {
        const items = z
          .array(itemsSchema.element)
          .max(50)
          .parse((await body(req)).items);
        await db.transaction(async (tx) => {
          await tx.query("DELETE FROM cart WHERE user_id=$1", [u.id]);
          for (const i of items)
            await tx.query(
              "INSERT INTO cart VALUES($1,$2,$3) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity",
              [u.id, i.productId, i.quantity],
            );
        });
      }
      return NextResponse.json({
        items: (
          await db.query(
            'SELECT product_id AS "productId",quantity FROM cart WHERE user_id=$1',
            [u.id],
          )
        ).rows,
      });
    }
    if (path === "wishlist") {
      const u = await requireUser(req);
      if (method === "POST") {
        const id = z
          .string()
          .max(100)
          .parse((await body(req)).productId);
        await db.transaction(async (tx) => {
          const r = await tx.query(
            "DELETE FROM wishlist WHERE user_id=$1 AND product_id=$2 RETURNING product_id",
            [u.id, id],
          );
          if (!r.rows.length)
            await tx.query(
              "INSERT INTO wishlist VALUES($1,$2) ON CONFLICT DO NOTHING",
              [u.id, id],
            );
        });
      }
      return NextResponse.json({
        ids: (
          await db.query("SELECT product_id FROM wishlist WHERE user_id=$1", [
            u.id,
          ])
        ).rows.map((r) => r.product_id),
      });
    }
    if (path === "orders") {
      const u = await requireUser(req);
      if (method === "POST") {
        await rateLimit("checkout:" + u.id, 30);
        const d = z
          .object({
            items: itemsSchema,
            address: addressSchema,
            key: z.string().uuid(),
          })
          .parse(await body(req));
        return NextResponse.json(
          { order: await createOrder(u, d.items, d.address, d.key) },
          { status: 201 },
        );
      }
      return NextResponse.json({ orders: await getOrders(u) });
    }
    const orderAction = path.match(
      /^orders\/([^/]+)\/(cancel|demo-pay|pay|verify|refund)$/,
    );
    if (orderAction && method === "POST") {
      const u = await requireUser(req);
      const [, id, action] = orderAction;
      const o = (
        await db.query("SELECT * FROM orders WHERE id=$1 AND user_id=$2", [
          id,
          u.id,
        ])
      ).rows[0];
      if (!o) throw new HttpError(404, "Order not found");
      if (action === "cancel") {
        await cancelOrder(u, id);
        return NextResponse.json({ ok: true });
      }
      if (action === "demo-pay") return NextResponse.json(await demoPay(u, id));
      const p = (
        await db.query("SELECT * FROM payments WHERE order_id=$1", [id])
      ).rows[0];
      if (action === "refund") {
        const d = z
          .object({
            amount_kobo: z.number().int().positive(),
            reason: z.string().min(5).max(500),
          })
          .parse(await body(req));
        await db.transaction(async (tx) => {
          await tx.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [id]);
          if (p.status !== "success")
            throw new HttpError(409, "Only confirmed payments can be refunded");
          const r = (
            await tx.query(
              "SELECT COALESCE(SUM(amount_kobo),0)::int AS total FROM refunds WHERE order_id=$1 AND status<>'rejected'",
              [id],
            )
          ).rows[0];
          if (d.amount_kobo + r.total > o.total_kobo)
            throw new HttpError(409, "Refund exceeds remaining paid amount");
          await tx.query(
            "INSERT INTO refunds(id,order_id,amount_kobo,reason) VALUES($1,$2,$3,$4)",
            [crypto.randomUUID(), id, d.amount_kobo, d.reason],
          );
          await audit(tx, u.id, "refund.requested", id);
        });
        return NextResponse.json({ ok: true });
      }
      if (p.provider !== "paystack")
        throw new HttpError(409, "This order uses simulated payment");
      if (action === "verify")
        return NextResponse.json(await reconcile(p.reference));
      if (o.status !== "pending_payment")
        throw new HttpError(409, "Order no longer payable");
      if (p.authorization_url)
        return NextResponse.json({ url: p.authorization_url });
      const result = await paystack("/transaction/initialize", {
        email: u.email,
        amount: p.amount_kobo,
        currency: "NGN",
        reference: p.reference,
        callback_url:
          (process.env.APP_ORIGIN ?? url.origin) + "/?payment=return",
        channels: ["card", "bank_transfer"],
      });
      await db.query(
        "UPDATE payments SET authorization_url=$1 WHERE reference=$2",
        [result.authorization_url, p.reference],
      );
      return NextResponse.json({ url: result.authorization_url });
    }
    if (path === "supplier/apply" && method === "POST") {
      const u = await requireUser(req, ["customer"]);
      const d = z
        .object({
          name: z.string().min(3).max(100),
          registration: z.string().min(3).max(100),
        })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO suppliers(id,user_id,name,registration) VALUES($1,$2,$3,$4)",
          [crypto.randomUUID(), u.id, d.name, d.registration],
        );
        await tx.query("UPDATE users SET role='supplier' WHERE id=$1", [u.id]);
        await audit(tx, u.id, "supplier.applied", u.id);
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "supplier/dashboard") {
      const { s } = await supplier(req);
      const products = (
        await db.query(
          "SELECT * FROM products WHERE supplier_id=$1 ORDER BY created_at DESC",
          [s.id],
        )
      ).rows;
      const fs = (
        await db.query(
          "SELECT f.*,o.address FROM fulfilments f JOIN orders o ON o.id=f.order_id WHERE f.supplier_id=$1 AND f.status<>'pending_payment' ORDER BY o.created_at DESC",
          [s.id],
        )
      ).rows;
      for (const f of fs)
        f.items = (
          await db.query(
            "SELECT name,quantity,supplier_due_kobo FROM order_items WHERE order_id=$1 AND supplier_id=$2",
            [f.order_id, s.id],
          )
        ).rows;
      const earnings = (
        await db.query(
          "SELECT COALESCE(SUM(i.supplier_due_kobo*i.quantity),0)::bigint AS accrued FROM order_items i JOIN payments p ON p.order_id=i.order_id WHERE i.supplier_id=$1 AND p.status='success'",
          [s.id],
        )
      ).rows[0];
      return NextResponse.json({
        supplier: s,
        products,
        fulfilments: fs,
        earnings,
        settlements: await settlementReport(s.id),
      });
    }
    if (path === "supplier/products" && method === "POST") {
      const { s, user } = await supplier(req);
      if (s.status !== "approved")
        throw new HttpError(403, "Supplier approval required");
      const data = await body(req);
      const products = z
        .array(productSchema)
        .min(1)
        .max(100)
        .parse(data.products);
      await db.transaction(async (tx) => {
        for (const p of products)
          await tx.query(
            "INSERT INTO products(id,supplier_id,category_id,name,description,cost_kobo,stock,image,group_key,variant_label) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [
              crypto.randomUUID(),
              s.id,
              p.category_id,
              p.name,
              p.description,
              p.cost_kobo,
              p.stock,
              p.image,
              p.group_key,
              p.variant_label,
            ],
          );
        await audit(tx, user.id, "products.created", s.id);
      });
      return NextResponse.json({ count: products.length });
    }
    if (path.startsWith("supplier/products/") && method === "PATCH") {
      const { s, user } = await supplier(req);
      if (s.status !== "approved")
        throw new HttpError(403, "Supplier approval required");
      const d = z
        .object({
          stock: z.number().int().min(0).max(100000),
          cost_kobo: z.number().int().min(100).max(100000000),
        })
        .parse(await body(req));
      const id = path.split("/")[2];
      await db.transaction(async (tx) => {
        const r = await tx.query(
          "UPDATE products SET stock=$1,cost_kobo=$2 WHERE id=$3 AND supplier_id=$4 RETURNING id",
          [d.stock, d.cost_kobo, id, s.id],
        );
        if (!r.rows.length) throw new HttpError(404, "Product not found");
        await audit(tx, user.id, "product.updated", id);
      });
      return NextResponse.json({ ok: true });
    }
    if (path.startsWith("supplier/fulfilments/") && method === "PATCH") {
      const { s, user } = await supplier(req);
      if (s.status !== "approved")
        throw new HttpError(403, "Supplier approval required");
      const id = path.split("/")[2];
      const d = z
        .object({
          status: z.enum(["processing", "shipped", "delivered", "failed"]),
          tracking: z.string().max(150).default(""),
        })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        const info = (
          await tx.query(
            "SELECT order_id FROM fulfilments WHERE id=$1 AND supplier_id=$2",
            [id, s.id],
          )
        ).rows[0];
        if (!info) throw new HttpError(404, "Fulfilment not found");
        const parent = (
          await tx.query("SELECT status FROM orders WHERE id=$1 FOR UPDATE", [
            info.order_id,
          ])
        ).rows[0];
        if (["refunded", "cancelled"].includes(parent.status))
          throw new HttpError(409, "Order is closed");
        const f = (
          await tx.query(
            "SELECT * FROM fulfilments WHERE id=$1 AND supplier_id=$2 FOR UPDATE",
            [id, s.id],
          )
        ).rows[0];
        if (!f) throw new HttpError(404, "Fulfilment not found");
        const next: Record<string, string[]> = {
          awaiting_supplier: ["processing", "failed"],
          processing: ["shipped", "failed"],
          shipped: ["delivered", "failed"],
        };
        if (!next[f.status]?.includes(d.status))
          throw new HttpError(409, "Invalid fulfilment transition");
        if (d.status === "shipped" && !d.tracking.trim())
          throw new HttpError(400, "Tracking reference required");
        await tx.query(
          "UPDATE fulfilments SET status=$1,tracking=$2 WHERE id=$3",
          [d.status, d.tracking || f.tracking, id],
        );
        await tx.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [
          f.order_id,
        ]);
        const fs = (
          await tx.query("SELECT status FROM fulfilments WHERE order_id=$1", [
            f.order_id,
          ])
        ).rows.map((r) => r.status);
        const state = fs.every((v) => v === "delivered")
          ? "delivered"
          : fs.some((v) => v === "failed")
            ? "failed"
            : fs.every((v) => ["shipped", "delivered"].includes(v))
              ? "shipped"
              : "processing";
        await tx.query(
          "UPDATE orders SET status=$1 WHERE id=$2 AND status NOT IN ('refunded','partially_refunded','cancelled')",
          [state, f.order_id],
        );
        await audit(tx, user.id, "fulfilment." + d.status, id);
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "admin/dashboard") {
      await requireUser(req, ["admin", "support"]);
      const orders = (
        await db.query(
          "SELECT o.id,o.status,o.total_kobo,o.created_at,p.provider,p.status AS payment_status,p.reference,p.fees_kobo FROM orders o JOIN payments p ON p.order_id=o.id ORDER BY o.created_at DESC LIMIT 100",
        )
      ).rows;
      return NextResponse.json({
        orders,
        finance: await financeReport(),
        settlements: await settlementReport(),
        returns: (
          await db.query(
            "SELECT * FROM return_requests ORDER BY created_at DESC LIMIT 100",
          )
        ).rows,
        tickets: (
          await db.query(
            "SELECT t.*,u.email FROM support_tickets t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 100",
          )
        ).rows,
        suppliers: (await db.query("SELECT * FROM suppliers ORDER BY name"))
          .rows,
        rules: (await db.query("SELECT * FROM pricing_rules")).rows,
        categories: (await db.query("SELECT * FROM categories")).rows,
        refunds: (
          await db.query(
            "SELECT * FROM refunds ORDER BY created_at DESC LIMIT 100",
          )
        ).rows,
        audit: (
          await db.query(
            "SELECT * FROM audit ORDER BY created_at DESC LIMIT 50",
          )
        ).rows,
        outbox: (
          await db.query(
            "SELECT * FROM outbox ORDER BY available_at DESC LIMIT 100",
          )
        ).rows,
        metrics: (
          await db.query(
            "SELECT COALESCE(SUM(amount_kobo),0)::bigint AS collected,COALESCE(SUM(fees_kobo),0)::bigint AS fees FROM payments WHERE status='success'",
          )
        ).rows[0],
      });
    }
    if (path === "admin/supplier" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      const d = z
        .object({
          id: z.string(),
          status: z.enum(["approved", "suspended"]),
          commission_bps: z.number().int().min(0).max(5000).default(0),
        })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        const r = await tx.query(
          "UPDATE suppliers SET status=$1,commission_bps=$2 WHERE id=$3 RETURNING id",
          [d.status, d.commission_bps, d.id],
        );
        if (!r.rows.length) throw new HttpError(404, "Supplier not found");
        await audit(tx, u.id, "supplier." + d.status, d.id);
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "admin/pricing" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      const d = z
        .object({
          category_id: z.string().nullable(),
          markup_bps: z.number().int().min(0).max(10000),
          fixed_kobo: z.number().int().min(0).max(10000000),
          discount_bps: z.number().int().min(0).max(9000),
          minimum_profit_kobo: z.number().int().min(0).max(10000000),
          shipping_subsidy_kobo: z
            .number()
            .int()
            .min(0)
            .max(10000000)
            .default(0),
          tax_bps: z.number().int().min(0).max(10000).default(0),
          other_cost_kobo: z.number().int().min(0).max(10000000).default(0),
        })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO pricing_rules(id,category_id,markup_bps,fixed_kobo,discount_bps,minimum_profit_kobo,shipping_subsidy_kobo,tax_bps,other_cost_kobo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET markup_bps=$3,fixed_kobo=$4,discount_bps=$5,minimum_profit_kobo=$6,shipping_subsidy_kobo=$7,tax_bps=$8,other_cost_kobo=$9",
          [
            d.category_id ?? "default",
            d.category_id,
            d.markup_bps,
            d.fixed_kobo,
            d.discount_bps,
            d.minimum_profit_kobo,
            d.shipping_subsidy_kobo,
            d.tax_bps,
            d.other_cost_kobo,
          ],
        );
        await audit(tx, u.id, "pricing.updated", d.category_id ?? "default");
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "admin/categories" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      const d = z
        .object({
          id: z.string().optional(),
          name: z.string().trim().min(2).max(100),
        })
        .parse(await body(req));
      await db.query(
        "INSERT INTO categories VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=$2",
        [d.id ?? crypto.randomUUID(), d.name],
      );
      await audit(db, u.id, "category.saved", d.name);
      return NextResponse.json({ ok: true });
    }
    if (path === "admin/dispatch" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      return NextResponse.json(await dispatchOutbox(u.id));
    }
    if (path === "admin/reconcile" && method === "POST") {
      await requireUser(req, ["admin"]);
      return NextResponse.json(
        await reconcile(
          z
            .string()
            .max(100)
            .parse((await body(req)).reference),
        ),
      );
    }
    if (path === "admin/refund" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      const id = z.string().parse((await body(req)).id);
      await db.transaction(async (tx) => {
        const r = (
          await tx.query(
            "SELECT r.*,p.provider FROM refunds r JOIN payments p ON p.order_id=r.order_id WHERE r.id=$1 FOR UPDATE OF r",
            [id],
          )
        ).rows[0];
        if (!r) throw new HttpError(404, "Refund not found");
        if (r.status === "processed") return;
        if (r.provider !== "simulated")
          throw new HttpError(
            409,
            "Paystack refunds require provider-dashboard processing and reconciliation; automated submission is not enabled",
          );
        await tx.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [
          r.order_id,
        ]);
        await tx.query("UPDATE refunds SET status='processed' WHERE id=$1", [
          id,
        ]);
        const amount = (
          await tx.query(
            "SELECT SUM(amount_kobo)::int AS total FROM refunds WHERE order_id=$1 AND status='processed'",
            [r.order_id],
          )
        ).rows[0].total;
        const o = (
          await tx.query("SELECT total_kobo FROM orders WHERE id=$1", [
            r.order_id,
          ])
        ).rows[0];
        await tx.query("UPDATE orders SET status=$1 WHERE id=$2", [
          amount === o.total_kobo ? "refunded" : "partially_refunded",
          r.order_id,
        ]);
        await audit(tx, u.id, "refund.simulated", id);
      });
      return NextResponse.json({ ok: true });
    }

    if (path === "support/tickets") {
      const u = await requireUser(req);
      if (method === "POST") {
        await rateLimit("support:" + u.id, 20);
        const d = z
          .object({
            subject: z.string().min(3).max(150),
            message: z.string().min(10).max(3000),
          })
          .parse(await body(req));
        await db.query(
          "INSERT INTO support_tickets(id,user_id,subject,message) VALUES($1,$2,$3,$4)",
          [crypto.randomUUID(), u.id, d.subject, d.message],
        );
      }
      return NextResponse.json({
        tickets: (
          await db.query(
            "SELECT * FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC",
            [u.id],
          )
        ).rows,
      });
    }
    if (path === "admin/ticket" && method === "POST") {
      const u = await requireUser(req, ["admin", "support"]);
      const d = z
        .object({
          id: z.string(),
          reply: z.string().min(3).max(3000),
          status: z.enum(["open", "resolved"]),
        })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        const r = await tx.query(
          "UPDATE support_tickets SET reply=$1,status=$2 WHERE id=$3 RETURNING id",
          [d.reply, d.status, d.id],
        );
        if (!r.rows.length) throw new HttpError(404, "Ticket not found");
        await audit(tx, u.id, "ticket.replied", d.id);
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "admin/expire" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      return NextResponse.json(await expireReservations(u));
    }
    if (path === "admin/settlement" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      return NextResponse.json(
        await simulateSettlement(
          u,
          z.string().parse((await body(req)).fulfilmentId),
        ),
      );
    }
    if (path === "admin/costs" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      const d = z
        .object({
          order_id: z.string(),
          shipping_kobo: z.number().int().min(0).max(200000000),
          tax_kobo: z.number().int().min(0).max(200000000),
          other_kobo: z.number().int().min(0).max(200000000),
          note: z.string().min(3).max(500),
        })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO order_costs(order_id,shipping_kobo,tax_kobo,other_kobo,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_id) DO UPDATE SET shipping_kobo=$2,tax_kobo=$3,other_kobo=$4,note=$5,updated_at=NOW()",
          [d.order_id, d.shipping_kobo, d.tax_kobo, d.other_kobo, d.note],
        );
        await audit(tx, u.id, "order.costs_reviewed", d.order_id);
      });
      return NextResponse.json({ ok: true });
    }

    if (path === "orders/return" && method === "POST") {
      const u = await requireUser(req);
      const d = z
        .object({ orderId: z.string(), reason: z.string().min(5).max(500) })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        const o = (
          await tx.query(
            "SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE",
            [d.orderId, u.id],
          )
        ).rows[0];
        if (!o) throw new HttpError(404, "Order not found");
        if (o.status !== "delivered")
          throw new HttpError(409, "Return requests require a delivered order");
        if (
          (
            await tx.query("SELECT id FROM return_requests WHERE order_id=$1", [
              o.id,
            ])
          ).rows.length
        )
          throw new HttpError(409, "A return request already exists");
        await tx.query(
          "INSERT INTO return_requests(id,order_id,reason) VALUES($1,$2,$3)",
          [crypto.randomUUID(), o.id, d.reason],
        );
        await audit(tx, u.id, "return.requested", o.id);
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "admin/return" && method === "POST") {
      const u = await requireUser(req, ["admin"]);
      const d = z
        .object({
          id: z.string(),
          status: z.enum(["approved", "received", "rejected"]),
          note: z.string().min(3).max(500),
        })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        const hint = (
          await tx.query("SELECT order_id FROM return_requests WHERE id=$1", [
            d.id,
          ])
        ).rows[0];
        if (!hint) throw new HttpError(404, "Return not found");
        await tx.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [
          hint.order_id,
        ]);
        const r = (
          await tx.query(
            "SELECT * FROM return_requests WHERE id=$1 FOR UPDATE",
            [d.id],
          )
        ).rows[0];
        const transitions: Record<string, string[]> = {
          requested: ["approved", "rejected"],
          approved: ["received", "rejected"],
        };
        if (!transitions[r.status]?.includes(d.status))
          throw new HttpError(409, "Invalid return transition");
        await tx.query(
          "UPDATE return_requests SET status=$1,note=$2 WHERE id=$3",
          [d.status, d.note, d.id],
        );
        if (d.status === "received")
          await tx.query(
            "UPDATE orders SET status='returned' WHERE id=$1 AND status NOT IN ('refunded','partially_refunded')",
            [r.order_id],
          );
        await audit(tx, u.id, "return." + d.status, d.id);
      });
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(404, "Endpoint not found");
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => i.path.join(".") + ": " + i.message)
            .join("; "),
        },
        { status: 400 },
      );
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Request failed", e?.code ?? e?.name);
    return NextResponse.json(
      { error: "Unable to complete request. Please try again." },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH };
