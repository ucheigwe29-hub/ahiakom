"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, money } from "@/lib/client";
import {
  ArrowRight,
  RefreshCw,
  Package,
  Store,
  Wallet,
  Activity,
} from "lucide-react";
export default function Dashboard({
  type,
  categories,
  notify,
}: {
  type: "supplier" | "admin";
  categories: any[];
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("overview");
  async function load() {
    try {
      setData(await api(type + "/dashboard"));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [type]);
  async function action(path: string, body: any, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(path, method, body);
      notify("Changes saved");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function values(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
  }
  if (!data)
    return (
      <section className="panel">
        <h1>{type === "supplier" ? "Seller workspace" : "Administration"}</h1>
        <p>{error || "Loading workspace…"}</p>
      </section>
    );
  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="overline">
            AHIAKOM /{" "}
            {type === "supplier" ? "SELLER WORKSPACE" : "ADMINISTRATION"}
          </span>
          <h1>
            {type === "supplier" ? data.supplier.name : "Marketplace overview"}
          </h1>
        </div>
        <button className="outline" onClick={load}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <p className="muted">
        Development data only. No actual supplier payouts or external
        fulfilment.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <nav className="workspace-tabs">
        {(type === "supplier"
          ? ["overview", "products", "orders", "settlements"]
          : [
              "overview",
              "suppliers",
              "orders",
              "pricing",
              "finance",
              "settlements",
              "categories",
              "refunds",
              "returns",
              "support",
              "audit",
            ]
        ).map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {type === "supplier" ? (
        <>
          {tab === "overview" && (
            <>
              <div className="metric-grid">
                <div>
                  <Store />
                  <small>Verification status</small>
                  <strong>{data.supplier.status}</strong>
                </div>
                <div>
                  <Package />
                  <small>Products</small>
                  <strong>{data.products.length}</strong>
                </div>
                <div>
                  <Wallet />
                  <small>Gross accrued supplier amount</small>
                  <strong>{money(Number(data.earnings.accrued))}</strong>
                  <small>Before returns, adjustments and settlement</small>
                </div>
              </div>
              <div className="panel">
                <h2>A good business starts with trust.</h2>
                <p>
                  {data.supplier.status === "approved"
                    ? "Your test supplier account is approved. Add products, update stock and process your assigned orders."
                    : "An administrator must review your business registration before products can be listed."}
                </p>
                <p>
                  Settlement reports currently show accrued amounts only. Bank
                  verification, payout scheduling and provider settlement
                  matching remain launch requirements.
                </p>
              </div>
            </>
          )}
          {tab === "products" && (
            <>
              <div className="panel">
                <h2>Add a product</h2>
                <form
                  className="grid-form"
                  onSubmit={(e) => {
                    const d = values(e);
                    action("supplier/products", {
                      products: [
                        {
                          ...d,
                          cost_kobo: Math.round(Number(d.cost) * 100),
                          stock: Number(d.stock),
                        },
                      ],
                    });
                  }}
                >
                  <label>
                    Product name
                    <input name="name" required minLength={3} />
                  </label>
                  <label>
                    Category
                    <select name="category_id">
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Supplier cost (₦)
                    <input
                      name="cost"
                      type="number"
                      min="1"
                      max="1000000"
                      step="0.01"
                      required
                    />
                  </label>
                  <label>
                    Available quantity
                    <input
                      name="stock"
                      type="number"
                      min="0"
                      max="100000"
                      required
                    />
                  </label>
                  <label>
                    Variant group (optional)
                    <input
                      name="group_key"
                      placeholder="e.g. studio-headphones"
                    />
                  </label>
                  <label>
                    Variant name (optional)
                    <input
                      name="variant_label"
                      placeholder="e.g. Green / Large"
                    />
                  </label>
                  <label>
                    Description
                    <textarea name="description" minLength={10} required />
                  </label>
                  <label>
                    Demonstration illustration
                    <select name="image">
                      {[
                        "bag",
                        "headphones",
                        "phone",
                        "laptop",
                        "blender",
                        "watch",
                        "sneakers",
                        "beauty",
                        "speaker",
                        "dumbbell",
                        "lamp",
                        "bottle",
                      ].map((i) => (
                        <option key={i} value={"/products/" + i + ".svg"}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary"
                    disabled={busy || data.supplier.status !== "approved"}
                  >
                    Add product <ArrowRight size={16} />
                  </button>
                </form>
                <details>
                  <summary>Bulk CSV upload</summary>
                  <p className="muted">
                    Columns: name,category_id,cost_kobo,stock,description.
                    Simple CSV only: no commas or newlines within fields.
                    Maximum 100 products. Amounts in kobo.
                  </p>
                  <input
                    aria-label="Upload product CSV"
                    type="file"
                    accept=".csv"
                    disabled={data.supplier.status !== "approved"}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 100000) {
                        setError("CSV exceeds 100 KB");
                        return;
                      }
                      try {
                        const text = await file.text();
                        const [header, ...rows] = text.trim().split(/\r?\n/);
                        if (
                          header.trim() !==
                          "name,category_id,cost_kobo,stock,description"
                        )
                          throw new Error("CSV header does not match");
                        const products = rows.map((row) => {
                          if (row.includes('"'))
                            throw new Error(
                              "Quoted CSV fields are not supported",
                            );
                          const fields = row.split(",");
                          if (fields.length !== 5)
                            throw new Error("Each row must contain 5 columns");
                          const [name, category_id, cost, stock, description] =
                            fields;
                          return {
                            name,
                            category_id,
                            cost_kobo: Number(cost),
                            stock: Number(stock),
                            description,
                          };
                        });
                        await action("supplier/products", { products });
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  />
                </details>
              </div>
              <div className="panel">
                <h2>Your inventory</h2>
                {data.products.length ? (
                  data.products.map((p: any) => (
                    <form
                      key={p.id}
                      className="inventory-row"
                      onSubmit={(e) => {
                        const d = values(e);
                        action(
                          "supplier/products/" + p.id,
                          {
                            stock: Number(d.stock),
                            cost_kobo: Math.round(Number(d.cost) * 100),
                          },
                          "PATCH",
                        );
                      }}
                    >
                      <strong>{p.name}</strong>
                      <label>
                        Stock
                        <input
                          aria-label={p.name + " stock"}
                          name="stock"
                          type="number"
                          min="0"
                          defaultValue={p.stock}
                        />
                      </label>
                      <label>
                        Cost (₦)
                        <input
                          name="cost"
                          type="number"
                          min="1"
                          step="0.01"
                          defaultValue={p.cost_kobo / 100}
                        />
                      </label>
                      <button disabled={busy} className="outline">
                        Save
                      </button>
                    </form>
                  ))
                ) : (
                  <p>No products yet.</p>
                )}
              </div>
            </>
          )}
          {tab === "orders" && (
            <div className="panel">
              <h2>Assigned fulfilments</h2>
              {data.fulfilments.length ? (
                data.fulfilments.map((f: any) => (
                  <article key={f.id} className="order-card">
                    <strong>{f.order_id.slice(0, 11)}</strong>
                    <span className="status">{f.status}</span>
                    {f.items.map((i: any, j: number) => (
                      <p key={j}>
                        {i.quantity} × {i.name} · supplier amount{" "}
                        {money(i.supplier_due_kobo * i.quantity)}
                      </p>
                    ))}
                    <p>
                      {f.address.name} · {f.address.phone}
                      <br />
                      {f.address.address}, {f.address.city}, {f.address.state}
                    </p>
                    <form
                      className="button-row"
                      onSubmit={(e) => {
                        const d = values(e);
                        action("supplier/fulfilments/" + f.id, d, "PATCH");
                      }}
                    >
                      <select name="status" aria-label="Next fulfilment status">
                        {(
                          {
                            awaiting_supplier: ["processing", "failed"],
                            processing: ["shipped", "failed"],
                            shipped: ["delivered", "failed"],
                          } as any
                        )[f.status]?.map((s: string) => (
                          <option key={s}>{s}</option>
                        )) ?? <option>{f.status}</option>}
                      </select>
                      <input
                        name="tracking"
                        placeholder="Tracking reference"
                        aria-label="Tracking reference"
                        defaultValue={f.tracking}
                      />
                      <button
                        disabled={
                          busy ||
                          ["failed", "delivered", "cancelled"].includes(
                            f.status,
                          )
                        }
                        className="primary"
                      >
                        Update
                      </button>
                    </form>
                  </article>
                ))
              ) : (
                <p>No paid orders assigned.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {tab === "overview" && (
            <>
              <div className="metric-grid">
                <div>
                  <Wallet />
                  <small>Confirmed test receipts</small>
                  <strong>{money(Number(data.metrics.collected))}</strong>
                </div>
                <div>
                  <Activity />
                  <small>Payment fees recorded</small>
                  <strong>{money(Number(data.metrics.fees))}</strong>
                </div>
                <div>
                  <Store />
                  <small>Suppliers pending approval</small>
                  <strong>
                    {
                      data.suppliers.filter((s: any) => s.status === "pending")
                        .length
                    }
                  </strong>
                </div>
              </div>
              <div className="panel">
                <div className="button-row">
                  <button
                    className="outline"
                    disabled={busy}
                    onClick={() => action("admin/expire", {})}
                  >
                    Release unpaid reservations older than 30 minutes
                  </button>
                </div>
                <h2>Fulfilment dispatch queue</h2>
                <p>
                  Direct vendors receive orders in their portal. The simulated
                  connector creates no external shipment.
                </p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => action("admin/dispatch", {})}
                >
                  Process pending dispatches
                </button>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Exception</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.outbox.map((j: any) => (
                        <tr key={j.id}>
                          <td>{j.id.slice(0, 8)}</td>
                          <td>{j.status}</td>
                          <td>{j.attempts}</td>
                          <td>{j.last_error ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {tab === "suppliers" && (
            <div className="panel">
              <h2>Supplier approvals & commissions</h2>
              <p className="muted">
                Approval here is an administrator decision; it does not
                constitute identity verification.
              </p>
              {data.suppliers.map((s: any) => (
                <form
                  className="inventory-row"
                  key={s.id}
                  onSubmit={(e) => {
                    const d = values(e);
                    action("admin/supplier", {
                      id: s.id,
                      status: d.status,
                      commission_bps: Math.round(Number(d.commission) * 100),
                    });
                  }}
                >
                  <div>
                    <strong>{s.name}</strong>
                    <small>
                      {s.registration || "Seeded demonstration vendor"} ·{" "}
                      {s.status}
                    </small>
                  </div>
                  <label>
                    Commission %
                    <input
                      name="commission"
                      type="number"
                      min="0"
                      max="50"
                      step="0.01"
                      defaultValue={s.commission_bps / 100}
                    />
                  </label>
                  <select
                    name="status"
                    aria-label="Supplier status"
                    defaultValue={
                      s.status === "suspended" ? "suspended" : "approved"
                    }
                  >
                    <option value="approved">Approve</option>
                    <option value="suspended">Suspend</option>
                  </select>
                  <button className="outline" disabled={busy}>
                    Save
                  </button>
                </form>
              ))}
            </div>
          )}
          {tab === "orders" && (
            <div className="panel">
              <h2>Orders & payment reconciliation</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o: any) => (
                      <tr key={o.id}>
                        <td>
                          {o.id.slice(0, 11)}
                          <small>
                            {new Date(o.created_at).toLocaleString()}
                          </small>
                        </td>
                        <td>{o.status}</td>
                        <td>{money(o.total_kobo)}</td>
                        <td>
                          {o.provider}
                          <small>{o.payment_status}</small>
                        </td>
                        <td>
                          {o.provider === "paystack" ? (
                            <button
                              disabled={busy}
                              onClick={() =>
                                action("admin/reconcile", {
                                  reference: o.reference,
                                })
                              }
                            >
                              Reconcile
                            </button>
                          ) : (
                            "Simulation"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "pricing" && (
            <div className="panel">
              <h2>Price & margin rules</h2>
              <p>
                Category rules override the global rule. Loss-making listings
                become unavailable at checkout. Current rules:
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Scope</th>
                      <th>Markup</th>
                      <th>Fixed</th>
                      <th>Discount</th>
                      <th>Profit floor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rules.map((r: any) => (
                      <tr key={r.id}>
                        <td>
                          {categories.find((c) => c.id === r.category_id)
                            ?.name ?? "Global"}
                        </td>
                        <td>{r.markup_bps / 100}%</td>
                        <td>{money(r.fixed_kobo)}</td>
                        <td>{r.discount_bps / 100}%</td>
                        <td>{money(r.minimum_profit_kobo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form
                className="grid-form"
                onSubmit={(e) => {
                  const d = values(e);
                  action("admin/pricing", {
                    category_id: d.category || null,
                    markup_bps: Math.round(Number(d.markup) * 100),
                    fixed_kobo: Math.round(Number(d.fixed) * 100),
                    discount_bps: Math.round(Number(d.discount) * 100),
                    minimum_profit_kobo: Math.round(Number(d.floor) * 100),
                    shipping_subsidy_kobo: Math.round(Number(d.subsidy) * 100),
                    tax_bps: Math.round(Number(d.tax) * 100),
                    other_cost_kobo: Math.round(Number(d.other) * 100),
                  });
                }}
              >
                <label>
                  Scope
                  <select name="category">
                    <option value="">Global</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Markup %
                  <input
                    name="markup"
                    type="number"
                    min="0"
                    max="100"
                    step=".01"
                    defaultValue="20"
                    required
                  />
                </label>
                <label>
                  Fixed markup ₦
                  <input
                    name="fixed"
                    type="number"
                    min="0"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Discount %
                  <input
                    name="discount"
                    type="number"
                    min="0"
                    max="90"
                    step=".01"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Minimum estimated profit ₦
                  <input
                    name="floor"
                    type="number"
                    min="0"
                    defaultValue="100"
                    required
                  />
                </label>
                <label>
                  Shipping subsidy per unit ₦
                  <input
                    name="subsidy"
                    type="number"
                    min="0"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Estimated tax burden %
                  <input
                    name="tax"
                    type="number"
                    min="0"
                    max="100"
                    step=".01"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Other estimated unit costs ₦
                  <input
                    name="other"
                    type="number"
                    min="0"
                    defaultValue="0"
                    required
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Save pricing rule
                </button>
              </form>
              <p className="muted">
                Estimates deduct supplier entitlement, local processing fees and
                the configured subsidy, tax burden and other unit costs. Zero
                tax is a test default, not a legal determination. Record actual
                order costs in Finance; refunds and payout charges require
                reconciliation.
              </p>
            </div>
          )}
          {tab === "categories" && (
            <div className="panel">
              <h2>Manage categories</h2>
              {data.categories.map((c: any) => (
                <form
                  className="button-row"
                  key={c.id}
                  onSubmit={(e) => {
                    const d = values(e);
                    action("admin/categories", { id: c.id, name: d.name });
                  }}
                >
                  <input
                    name="name"
                    required
                    minLength={2}
                    defaultValue={c.name}
                  />
                  <button disabled={busy}>Rename</button>
                </form>
              ))}
              <form
                className="button-row"
                onSubmit={(e) => {
                  const d = values(e);
                  action("admin/categories", { name: d.name });
                }}
              >
                <input
                  name="name"
                  required
                  minLength={2}
                  placeholder="New category name"
                />
                <button className="primary" disabled={busy}>
                  Add category
                </button>
              </form>
            </div>
          )}
          {tab === "refunds" && (
            <div className="panel">
              <h2>Refund requests</h2>
              {data.refunds.map((r: any) => (
                <article className="order-card" key={r.id}>
                  <strong>
                    {r.order_id.slice(0, 11)} · {money(r.amount_kobo)}
                  </strong>
                  <p>{r.reason}</p>
                  <p>{r.status}</p>
                  <button
                    className="outline"
                    disabled={busy || r.status === "processed"}
                    onClick={() => action("admin/refund", { id: r.id })}
                  >
                    Process simulated refund
                  </button>
                </article>
              ))}
              <p className="muted">
                Real provider refunds are not automated in this build. Returns
                inspection, restocking and supplier recovery require a separate
                reviewed workflow.
              </p>
            </div>
          )}

          {tab === "finance" && (
            <div className="panel">
              <h2>Contribution & cost reconciliation</h2>
              <p className="muted">
                Contribution = receipts − supplier entitlement − payment fees −
                processed refunds − recorded delivery, tax and other costs. This
                excludes overhead and is provisional until costs are reviewed.
                Refunded supplier recovery is not assumed.
              </p>
              {data.finance.map((o: any) => (
                <article className="order-card" key={o.id}>
                  <div className="between">
                    <strong>{o.id.slice(0, 11)}</strong>
                    <span className="status">
                      {o.costs_reviewed ? "Costs reviewed" : "Costs incomplete"}
                    </span>
                  </div>
                  <p>
                    Gross product markup: {money(o.gross_markup_kobo)} ·
                    Contribution: {money(o.contribution_kobo)} · Refunds:{" "}
                    {money(Number(o.refunded_kobo))}
                  </p>
                  <form
                    className="grid-form"
                    onSubmit={(e) => {
                      const d = values(e);
                      action("admin/costs", {
                        order_id: o.id,
                        shipping_kobo: Math.round(Number(d.shipping) * 100),
                        tax_kobo: Math.round(Number(d.tax) * 100),
                        other_kobo: Math.round(Number(d.other) * 100),
                        note: d.note,
                      });
                    }}
                  >
                    <label>
                      Actual delivery cost ₦
                      <input
                        name="shipping"
                        type="number"
                        min="0"
                        step=".01"
                        defaultValue={o.delivery_cost_kobo / 100}
                        required
                      />
                    </label>
                    <label>
                      Tax liability ₦
                      <input
                        name="tax"
                        type="number"
                        min="0"
                        step=".01"
                        defaultValue={o.tax_kobo / 100}
                        required
                      />
                    </label>
                    <label>
                      Other order costs ₦
                      <input
                        name="other"
                        type="number"
                        min="0"
                        step=".01"
                        defaultValue={o.other_kobo / 100}
                        required
                      />
                    </label>
                    <label>
                      Review note
                      <input name="note" required minLength={3} />
                    </label>
                    <button className="primary" disabled={busy}>
                      Record costs
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
          {tab === "returns" && (
            <div className="panel">
              <h2>Return requests</h2>
              <p className="muted">
                Receiving a return does not automatically restock inventory or
                issue a refund. Inspect goods, adjust stock and process the
                refund separately.
              </p>
              {data.returns.map((r: any) => (
                <article className="order-card" key={r.id}>
                  <strong>{r.order_id.slice(0, 11)}</strong>
                  <span className="status">{r.status}</span>
                  <p>{r.reason}</p>
                  <form
                    onSubmit={(e) => {
                      const d = values(e);
                      action("admin/return", { id: r.id, ...d });
                    }}
                  >
                    <label>
                      Inspection / decision note
                      <input name="note" minLength={3} required />
                    </label>
                    <div className="button-row">
                      <select name="status" aria-label="Return decision">
                        {(r.status === "requested"
                          ? ["approved", "rejected"]
                          : ["received", "rejected"]
                        ).map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        className="primary"
                        disabled={
                          busy || ["received", "rejected"].includes(r.status)
                        }
                      >
                        Record decision
                      </button>
                    </div>
                  </form>
                </article>
              ))}
            </div>
          )}
          {tab === "support" && (
            <div className="panel">
              <h2>Customer support inbox</h2>
              {data.tickets.map((t: any) => (
                <article className="order-card" key={t.id}>
                  <strong>{t.subject}</strong>
                  <small>
                    {t.email} · {t.status}
                  </small>
                  <p>{t.message}</p>
                  <form
                    onSubmit={(e) => {
                      const d = values(e);
                      action("admin/ticket", { id: t.id, ...d });
                    }}
                  >
                    <label>
                      Reply
                      <textarea
                        name="reply"
                        required
                        minLength={3}
                        defaultValue={t.reply}
                      />
                    </label>
                    <div className="button-row">
                      <select
                        aria-label="Ticket status"
                        name="status"
                        defaultValue={t.status}
                      >
                        <option>open</option>
                        <option>resolved</option>
                      </select>
                      <button className="primary" disabled={busy}>
                        Save reply in portal
                      </button>
                    </div>
                  </form>
                </article>
              ))}
            </div>
          )}
          {tab === "audit" && (
            <div className="panel">
              <h2>Audit trail</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((a: any) => (
                      <tr key={a.id}>
                        <td>{new Date(a.created_at).toLocaleString()}</td>
                        <td>{a.action}</td>
                        <td>{a.entity_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "settlements" && (
        <div className="panel">
          <h2>Supplier settlement ledger</h2>
          <p className="muted">
            No bank transfers are made. Only delivered, paid simulated orders
            without refund holds can be marked as a simulated settlement. Actual
            provider settlement matching remains unconnected.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Supplier</th>
                  <th>Entitlement</th>
                  <th>Fulfilment</th>
                  <th>Settlement</th>
                </tr>
              </thead>
              <tbody>
                {data.settlements.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.order_id.slice(0, 11)}</td>
                    <td>{s.supplier}</td>
                    <td>{money(Number(s.amount_kobo))}</td>
                    <td>{s.status}</td>
                    <td>
                      {s.provider_reference ??
                        (s.refund_hold ? (
                          "Refund hold"
                        ) : type === "admin" ? (
                          <button
                            className="outline"
                            disabled={busy || s.status !== "delivered"}
                            onClick={() =>
                              action("admin/settlement", { fulfilmentId: s.id })
                            }
                          >
                            Simulate settlement
                          </button>
                        ) : (
                          "Not settled"
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
