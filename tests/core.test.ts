import sharp from "sharp";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
// Never inherit a production database connection into the test suite.
process.env.DATABASE_DRIVER = "pglite";
process.env.DATABASE_PATH = "memory://";
if (process.env.TEST_DATABASE_URL) {
  const testUrl = new URL(process.env.TEST_DATABASE_URL);
  if (
    !testUrl.pathname.endsWith("_test") ||
    !["localhost", "127.0.0.1", "postgres"].includes(testUrl.hostname)
  ) {
    throw new Error(
      "Integration tests require an explicitly isolated local *_test database",
    );
  }
  process.env.DATABASE_DRIVER = "postgres";
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.ENABLE_DEMO_PAYMENTS = "true";
process.env.PAYMENT_MODE = "simulated";
process.env.APP_ORIGIN = "http://localhost:3000";
import { seed } from "../scripts/seed";
import { database } from "../lib/db";
import { price, defaultRule, feeEstimate } from "../lib/pricing";
import {
  createOrder,
  confirmPayment,
  cancelOrder,
  demoPay,
} from "../lib/orders";
import { verifySignature } from "../lib/paystack";
import { hashPassword, checkPassword, type User } from "../lib/auth";
import { POST, GET, PATCH } from "../app/api/[...path]/route";
const user: User = {
  id: "test-customer",
  name: "Test Customer",
  email: "test@example.invalid",
  role: "customer",
};
const address = {
  name: "Test Person",
  phone: "08000000000",
  address: "10 Demo Street",
  city: "Port Harcourt",
  state: "Rivers",
};
before(async () => {
  await seed();
  const db = await database();
  await db.query(
    "INSERT INTO users(id,email,name,password,role) VALUES($1,$2,$3,$4,$5)",
    [
      user.id,
      user.email,
      user.name,
      await hashPassword("long-test-password"),
      user.role,
    ],
  );
});
async function call(
  path: string,
  method = "GET",
  data?: unknown,
  cookie?: string,
  origin = "http://localhost:3000",
) {
  const req = new Request("http://localhost:3000/api/" + path, {
    method,
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      "content-type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return (method === "GET" ? GET : method === "PATCH" ? PATCH : POST)(req, {
    params: Promise.resolve({ path: path.split("/") }),
  });
}
let order: any;
test("pricing: ₦15,000 + 20% = ₦18,000 with separate supplier entitlement", () => {
  const p = price(1500000);
  assert.equal(p.selling, 1800000);
  assert.equal(p.supplierDue, 1500000);
  assert.equal(p.estimatedMargin, 263000);
});
test("loss-making discounts cannot sell and commission affects entitlement", () => {
  assert.equal(
    price(1500000, { ...defaultRule, discount_bps: 9000 }).sellable,
    false,
  );
  assert.equal(price(1500000, defaultRule, 1000).supplierDue, 1350000);
  assert.throws(() => price(-1));
  assert.equal(feeEstimate(100000000), 200000);
});
test("password hash verifies without storing plaintext", async () => {
  const h = await hashPassword("test-secure-password");
  assert(!h.includes("test-secure-password"));
  assert(await checkPassword("test-secure-password", h));
  assert(!(await checkPassword("wrong", h)));
});
test("checkout persists server-calculated prices and splits by supplier", async () => {
  order = await createOrder(
    user,
    [
      { productId: "headphones", quantity: 1 },
      { productId: "blender", quantity: 1 },
    ],
    address,
    crypto.randomUUID(),
  );
  assert.equal(order.shipping_kobo, 500000);
  assert.equal(order.subtotal_kobo, 4500000 + 2799960);
  const db = await database();
  assert.equal(
    (await db.query("SELECT * FROM fulfilments WHERE order_id=$1", [order.id]))
      .rows.length,
    2,
  );
});
test("idempotent checkout does not reserve stock twice; changed payload conflicts", async () => {
  const db = await database();
  const before = (await db.query("SELECT stock FROM products WHERE id='watch'"))
    .rows[0].stock;
  const key = crypto.randomUUID();
  const items = [{ productId: "watch", quantity: 1 }];
  const a = await createOrder(user, items, address, key);
  const b = await createOrder(user, items, address, key);
  assert.equal(a.id, b.id);
  assert.equal(
    (await db.query("SELECT stock FROM products WHERE id='watch'")).rows[0]
      .stock,
    before - 1,
  );
  await assert.rejects(
    () =>
      createOrder(user, [{ productId: "watch", quantity: 2 }], address, key),
    /different basket/,
  );
});
test("overselling rolls back whole transaction", async () => {
  const db = await database();
  const before = (
    await db.query("SELECT stock FROM products WHERE id='headphones'")
  ).rows[0].stock;
  await db.query("UPDATE products SET stock=1 WHERE id='watch'");
  await assert.rejects(
    () =>
      createOrder(
        user,
        [
          { productId: "headphones", quantity: 1 },
          { productId: "watch", quantity: 2 },
        ],
        address,
        crypto.randomUUID(),
      ),
    /insufficient/,
  );
  assert.equal(
    (await db.query("SELECT stock FROM products WHERE id='headphones'")).rows[0]
      .stock,
    before,
  );
});
test("simultaneous orders cannot consume the same final stock unit", async () => {
  const db = await database();
  await db.query("UPDATE products SET stock=1 WHERE id='bag'");
  const other = {
    ...user,
    id: "second-customer",
    email: "second@example.invalid",
  };
  await db.query(
    "INSERT INTO users(id,email,name,password,role) VALUES($1,$2,$3,$4,$5)",
    [other.id, other.email, other.name, "unused", "customer"],
  );
  const attempts = await Promise.allSettled(
    [user, other].map((buyer) =>
      createOrder(
        buyer,
        [{ productId: "bag", quantity: 1 }],
        address,
        crypto.randomUUID(),
      ),
    ),
  );
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.query("SELECT stock FROM products WHERE id='bag'")).rows[0].stock,
    0,
  );
});
test("wrong payment amount is rejected; replay creates no duplicate dispatch", async () => {
  const db = await database();
  const p = (
    await db.query("SELECT * FROM payments WHERE order_id=$1", [order.id])
  ).rows[0];
  await assert.rejects(
    () => confirmPayment(p.reference, 1, "NGN", "fake", "simulated"),
    /mismatch/,
  );
  await demoPay(user, order.id);
  assert.equal((await demoPay(user, order.id)).duplicate, true);
  assert.equal(
    (
      await db.query(
        "SELECT * FROM outbox j JOIN fulfilments f ON f.id=j.fulfilment_id WHERE f.order_id=$1",
        [order.id],
      )
    ).rows.length,
    2,
  );
});
test("unpaid cancellation restores stock exactly once, late payment flagged", async () => {
  const db = await database();
  const before = (
    await db.query("SELECT stock FROM products WHERE id='speaker'")
  ).rows[0].stock;
  const o = await createOrder(
    user,
    [{ productId: "speaker", quantity: 1 }],
    address,
    crypto.randomUUID(),
  );
  await cancelOrder(user, o.id);
  await cancelOrder(user, o.id);
  assert.equal(
    (await db.query("SELECT stock FROM products WHERE id='speaker'")).rows[0]
      .stock,
    before,
  );
  const p = (await db.query("SELECT * FROM payments WHERE order_id=$1", [o.id]))
    .rows[0];
  assert.equal(
    (
      await confirmPayment(
        p.reference,
        p.amount_kobo,
        "NGN",
        "late",
        "simulated",
      )
    ).exception,
    true,
  );
});
test("modern signature rejects tampering, stale timestamps and legacy downgrade", () => {
  const raw = '{"event":"charge.success"}',
    secret = "whsec_test",
    time = 1700000000;
  const sig = createHmac("sha512", secret)
    .update(time + "." + raw)
    .digest("hex");
  const header = `t=${time},v1=whk_test:${sig}`;
  assert(verifySignature(raw, header, null, secret, "sk_test_key", time));
  assert(
    !verifySignature(raw + " ", header, null, secret, "sk_test_key", time),
  );
  assert(
    !verifySignature(raw, header, null, secret, "sk_test_key", time + 301),
  );
  const legacy = createHmac("sha512", "sk_test_key").update(raw).digest("hex");
  assert(verifySignature(raw, null, legacy, undefined, "sk_test_key"));
  assert(!verifySignature(raw, null, legacy, secret, "sk_test_key"));
});
test("anonymous and customer cannot access admin; CSRF origin blocked", async () => {
  assert.equal((await call("admin/dashboard")).status, 401);
  const login = await call("auth/login", "POST", {
    email: user.email,
    password: "long-test-password",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await call("admin/dashboard", "GET", undefined, cookie)).status,
    403,
  );
  assert.equal(
    (await call("orders", "POST", {}, cookie, "https://evil.invalid")).status,
    403,
  );
  assert.equal(
    (
      await call(
        "orders",
        "POST",
        {
          items: [{ productId: "phone", quantity: -1 }],
          address,
          key: crypto.randomUUID(),
        },
        cookie,
      )
    ).status,
    400,
  );
});
test("public catalog never leaks supplier costs, commissions or passwords", async () => {
  const response = await call("catalog");
  const content = await response.text();
  assert(!content.includes("cost_kobo"));
  assert(!content.includes("commission_bps"));
  assert(!content.includes("supplier_due_kobo"));
});
test("supplier ownership prevents access to another seller inventory", async () => {
  const db = await database();
  const uid = "seller-test";
  await db.query(
    "INSERT INTO users(id,email,name,password,role) VALUES($1,'seller@example.invalid','Test Seller',$2,'supplier')",
    [uid, await hashPassword("seller-password-123")],
  );
  await db.query(
    "INSERT INTO suppliers(id,user_id,name,status) VALUES('seller-test',$1,'Test Supplier','approved')",
    [uid],
  );
  const res = await call("auth/login", "POST", {
    email: "seller@example.invalid",
    password: "seller-password-123",
  });
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  const dashboard = await (
    await call("supplier/dashboard", "GET", undefined, cookie)
  ).json();
  assert.equal(dashboard.products.length, 0);
  assert.equal(
    (
      await call(
        "supplier/products/headphones",
        "PATCH",
        { stock: 100, cost_kobo: 1000 },
        cookie,
      )
    ).status,
    404,
  );
});
test("refund requests cannot exceed paid amount", async () => {
  const login = await call("auth/login", "POST", {
    email: user.email,
    password: "long-test-password",
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (
      await call(
        "orders/" + order.id + "/refund",
        "POST",
        { amount_kobo: order.total_kobo + 1, reason: "Test refund" },
        cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "orders/" + order.id + "/refund",
        "POST",
        { amount_kobo: 10000, reason: "Test refund" },
        cookie,
      )
    ).status,
    200,
  );
});

test("pricing includes configured tax, shipping subsidy and other costs", () => {
  const base = price(1500000);
  const adjusted = price(1500000, {
    ...defaultRule,
    shipping_subsidy_kobo: 10000,
    tax_bps: 500,
    other_cost_kobo: 5000,
  });
  assert.equal(base.estimatedMargin - adjusted.estimatedMargin, 105000);
});
test("customer registration never accepts a forged admin role", async () => {
  const r = await call("auth/register", "POST", {
    name: "New Test User",
    email: "new@example.invalid",
    password: "new-test-password-123",
    role: "admin",
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.role, "customer");
  assert.match(r.headers.get("set-cookie") ?? "", /HttpOnly/i);
});
test("supplier lifecycle: pending approval, isolated product, fulfilment and settlement", async () => {
  const db = await database();
  await db.query(
    "INSERT INTO users(id,email,name,password,role) VALUES('admin-test','admin@example.invalid','Admin',$1,'admin')",
    [await hashPassword("admin-test-password")],
  );
  const adminLogin = await call("auth/login", "POST", {
    email: "admin@example.invalid",
    password: "admin-test-password",
  });
  const adminCookie = adminLogin.headers.get("set-cookie")!.split(";")[0];
  const signup = await call("auth/register", "POST", {
    name: "Vendor Tester",
    email: "vendor@example.invalid",
    password: "vendor-test-password",
  });
  const sellerCookie = signup.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (
      await call(
        "supplier/apply",
        "POST",
        { name: "Test Vendor Store", registration: "TEST-REG-123" },
        sellerCookie,
      )
    ).status,
    200,
  );
  const dashboard = await (
    await call("supplier/dashboard", "GET", undefined, sellerCookie)
  ).json();
  assert.equal(dashboard.supplier.status, "pending");
  const product = {
    name: "Test seller headphones",
    description: "A test-only sample listing",
    category_id: "cat-2",
    stock: 3,
    cost_kobo: 1000000,
  };
  assert.equal(
    (
      await call(
        "supplier/products",
        "POST",
        { products: [product] },
        sellerCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "admin/supplier",
        "POST",
        { id: dashboard.supplier.id, status: "approved" },
        adminCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "supplier/products",
        "POST",
        { products: [product] },
        sellerCookie,
      )
    ).status,
    200,
  );
  const inventory = await (
    await call("supplier/dashboard", "GET", undefined, sellerCookie)
  ).json();
  const pid = inventory.products[0].id;
  const photoBytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const updated = await call(
    "supplier/products/" + pid,
    "PATCH",
    {
      name: "Updated headphones",
      description: "Detailed updated listing",
      photo: photoBytes.toString("base64"),
    },
    sellerCookie,
  );
  assert.equal(updated.status, 200);
  const published = await call("photos/" + pid);
  assert.equal(published.headers.get("content-type"), "image/webp");
  assert.equal(
    (await sharp(Buffer.from(await published.arrayBuffer())).metadata()).format,
    "webp",
  );
  const rejected = await call(
    "supplier/products/" + pid,
    "PATCH",
    { name: "Bad photo edit", photo: "YWJj" },
    sellerCookie,
  );
  assert.equal(rejected.status, 400);
  const saved = (
    await (
      await call("supplier/dashboard", "GET", undefined, sellerCookie)
    ).json()
  ).products[0];
  assert.equal(saved.name, "Updated headphones");
  assert.equal(saved.stock, 3);
  assert.match(saved.image, /^\/api\/photos\//);
  const o = await createOrder(
    user,
    [{ productId: pid, quantity: 1 }],
    address,
    crypto.randomUUID(),
  );
  await demoPay(user, o.id);
  let seller = await (
    await call("supplier/dashboard", "GET", undefined, sellerCookie)
  ).json();
  assert.equal(seller.fulfilments.length, 1);
  const fid = seller.fulfilments[0].id;
  assert.equal(
    (
      await call(
        "supplier/fulfilments/" + fid,
        "PATCH",
        { status: "delivered" },
        sellerCookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("admin/settlement", "POST", { fulfilmentId: fid }, adminCookie))
      .status,
    409,
  );
  assert.equal(
    (
      await call(
        "supplier/fulfilments/" + fid,
        "PATCH",
        { status: "processing" },
        sellerCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "supplier/fulfilments/" + fid,
        "PATCH",
        { status: "shipped" },
        sellerCookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "supplier/fulfilments/" + fid,
        "PATCH",
        { status: "shipped", tracking: "TEST-TRACK-01" },
        sellerCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "supplier/fulfilments/" + fid,
        "PATCH",
        { status: "delivered" },
        sellerCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("admin/settlement", "POST", { fulfilmentId: fid }, adminCookie))
      .status,
    200,
  );
  assert.equal(
    (await call("admin/settlement", "POST", { fulfilmentId: fid }, adminCookie))
      .status,
    200,
  );
  assert.equal(
    (await db.query("SELECT * FROM settlements WHERE fulfilment_id=$1", [fid]))
      .rows.length,
    1,
  );
});
test("support tickets are private and support role cannot change pricing", async () => {
  const db = await database();
  const login = await call("auth/login", "POST", {
    email: user.email,
    password: "long-test-password",
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const response = await call(
    "support/tickets",
    "POST",
    {
      subject: "Demo support request",
      message: "Please help with a demonstration order",
    },
    cookie,
  );
  assert.equal(response.status, 200);
  const ticket = (await response.json()).tickets[0];
  await db.query(
    "INSERT INTO users(id,email,name,password,role) VALUES('support-test','support@example.invalid','Support',$1,'support')",
    [await hashPassword("support-test-password")],
  );
  const l = await call("auth/login", "POST", {
    email: "support@example.invalid",
    password: "support-test-password",
  });
  const supportCookie = l.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await call("admin/pricing", "POST", {}, supportCookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        "admin/ticket",
        "POST",
        {
          id: ticket.id,
          status: "resolved",
          reply: "Your test request has been reviewed.",
        },
        supportCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await (await call("support/tickets", "GET", undefined, cookie)).json())
      .tickets[0].status,
    "resolved",
  );
});
test("expired reservation maintenance restores stock and is idempotent", async () => {
  const { expireReservations } = await import("../lib/operations");
  const db = await database();
  const before = (await db.query("SELECT stock FROM products WHERE id='phone'"))
    .rows[0].stock;
  const o = await createOrder(
    user,
    [{ productId: "phone", quantity: 1 }],
    address,
    crypto.randomUUID(),
  );
  await db.query(
    "UPDATE orders SET created_at=NOW()-INTERVAL '1 hour' WHERE id=$1",
    [o.id],
  );
  const actor = { ...user, role: "admin" as const };
  assert.equal((await expireReservations(actor)).expired, 1);
  assert.equal((await expireReservations(actor)).expired, 0);
  assert.equal(
    (await db.query("SELECT stock FROM products WHERE id='phone'")).rows[0]
      .stock,
    before,
  );
});
test("Paystack verification adapter requires successful test-domain matching amounts", async () => {
  const { reconcile } = await import("../lib/paystack");
  const db = await database();
  process.env.PAYMENT_MODE = "paystack";
  const o = await createOrder(
    user,
    [{ productId: "phone", quantity: 1 }],
    address,
    crypto.randomUUID(),
  );
  process.env.PAYMENT_MODE = "simulated";
  const p = (await db.query("SELECT * FROM payments WHERE order_id=$1", [o.id]))
    .rows[0];
  const original = globalThis.fetch;
  const previousKey = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "sk_test_fixture_only";
  try {
    let amount = p.amount_kobo + 1;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: true,
          data: {
            reference: p.reference,
            status: "success",
            domain: "test",
            amount,
            currency: "NGN",
            id: "fixture-provider-id",
            fees: 10000,
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    await assert.rejects(() => reconcile(p.reference), /mismatch/);
    amount = p.amount_kobo;
    await reconcile(p.reference);
    assert.equal(
      (
        await db.query("SELECT status FROM payments WHERE reference=$1", [
          p.reference,
        ])
      ).rows[0].status,
      "success",
    );
  } finally {
    globalThis.fetch = original;
    if (previousKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousKey;
  }
});
test("production Paystack keys are refused", async () => {
  const { paystack } = await import("../lib/paystack");
  const prior = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "sk_live_fixture_not_a_real_key";
  try {
    await assert.rejects(
      () => paystack("/transaction/verify/example"),
      /Live keys are disabled/,
    );
  } finally {
    if (prior === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = prior;
  }
});

test("dispatch claims jobs once and reports direct portal delivery", async () => {
  const { dispatchOutbox } = await import("../lib/connectors");
  const first = await dispatchOutbox("admin-test");
  assert(first.sent >= 1);
  assert.equal((await dispatchOutbox("admin-test")).sent, 0);
});
test("return workflow blocks invalid transitions and keeps customer ownership", async () => {
  const db = await database();
  const customerLogin = await call("auth/login", "POST", {
    email: user.email,
    password: "long-test-password",
  });
  const cookie = customerLogin.headers.get("set-cookie")!.split(";")[0];
  const adminLogin = await call("auth/login", "POST", {
    email: "admin@example.invalid",
    password: "admin-test-password",
  });
  const adminCookie = adminLogin.headers.get("set-cookie")!.split(";")[0];
  const o = (
    await db.query(
      "SELECT * FROM orders WHERE user_id=$1 AND status='delivered' LIMIT 1",
      [user.id],
    )
  ).rows[0];
  assert(o);
  const submitted = await call(
    "orders/return",
    "POST",
    { orderId: o.id, reason: "Test return request for review" },
    cookie,
  );
  assert.equal(submitted.status, 200);
  const r = (
    await db.query("SELECT * FROM return_requests WHERE order_id=$1", [o.id])
  ).rows[0];
  assert.equal(
    (
      await call(
        "admin/return",
        "POST",
        {
          id: r.id,
          status: "received",
          note: "Cannot receive before approval",
        },
        adminCookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "admin/return",
        "POST",
        { id: r.id, status: "approved", note: "Approved test return" },
        adminCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "admin/return",
        "POST",
        {
          id: r.id,
          status: "received",
          note: "Test goods received and inspected",
        },
        adminCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await db.query("SELECT status FROM orders WHERE id=$1", [o.id])).rows[0]
      .status,
    "returned",
  );
});
test("finance records actual costs separately from gross markup", async () => {
  const { financeReport } = await import("../lib/operations");
  const login = await call("auth/login", "POST", {
    email: "admin@example.invalid",
    password: "admin-test-password",
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const before = (await financeReport()).find((r) => r.id === order.id)!;
  assert.equal(before.costs_reviewed, false);
  const response = await call(
    "admin/costs",
    "POST",
    {
      order_id: order.id,
      shipping_kobo: 300000,
      tax_kobo: 10000,
      other_kobo: 5000,
      note: "Test reviewed costs",
    },
    cookie,
  );
  assert.equal(response.status, 200);
  const after = (await financeReport()).find((r) => r.id === order.id)!;
  assert.equal(after.costs_reviewed, true);
  assert.equal(before.contribution_kobo - after.contribution_kobo, 315000);
});
