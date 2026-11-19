"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  ShoppingBag,
  Search,
  Heart,
  ShoppingCart,
  UserRound,
  ArrowRight,
  ArrowLeft,
  Menu,
  ChevronDown,
  ChevronRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  Headphones,
  Smartphone,
  Laptop,
  House,
  Shirt,
  Sparkles,
  Dumbbell,
  Baby,
  Car,
  Package,
  Monitor,
  LayoutGrid,
  Tag,
  Home,
  X,
  Plus,
  Minus,
  Check,
  LogOut,
  Store,
  SlidersHorizontal,
  MapPin,
  Leaf,
} from "lucide-react";
import Dashboard from "./dashboard";
import { money, api } from "@/lib/client";
import Support from "./support";
type Product = {
  id: string;
  group_key: string;
  variant_label: string;
  name: string;
  description: string;
  image: string;
  price: number;
  original: number;
  stock: number;
  available: boolean;
  supplier_id: string;
  seller: string;
  category_id: string;
  brand: string;
};
type Basket = Record<string, number>;
const icons = [
  Smartphone,
  Laptop,
  Headphones,
  House,
  Shirt,
  Sparkles,
  Dumbbell,
  Baby,
  Car,
  ShoppingBag,
  Monitor,
  LayoutGrid,
];
export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]),
    [categories, setCategories] = useState<any[]>([]),
    [cart, setCart] = useState<Basket>({}),
    [wishlist, setWishlist] = useState<string[]>([]),
    [user, setUser] = useState<any>(null),
    [ready, setReady] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("featured"),
    [view, setView] = useState("home"),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<Product | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [register, setRegister] = useState(false),
    [orders, setOrders] = useState<any[]>([]),
    [slide, setSlide] = useState(0),
    [page, setPage] = useState(1),
    [onlyStock, setOnlyStock] = useState(false),
    [maxPrice, setMaxPrice] = useState(""),
    [loaded, setLoaded] = useState(false);
  const cartWrites = useRef(Promise.resolve());
  const checkoutKey = useRef(crypto.randomUUID());
  const catalogRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialTouch = useRef(0);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 3500);
  };
  const refresh = async () => {
    const d = await api("catalog");
    let all = d.products;
    for (let p = 2; all.length < d.total; p++) {
      const more = await api("catalog?page=" + p);
      if (!more.products.length) break;
      all = [...all, ...more.products];
    }
    setProducts(all);
    setCategories(
      d.categories.sort(
        (a: any, b: any) =>
          Number(a.id.split("-")[1]) - Number(b.id.split("-")[1]),
      ),
    );
    setLoaded(true);
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    api("auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {});
    try {
      setCart(JSON.parse(localStorage.getItem("ahiakom-cart") ?? "{}"));
      setWishlist(JSON.parse(localStorage.getItem("ahiakom-wishlist") ?? "[]"));
    } catch {}
    setReady(true);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (new URLSearchParams(location.search).has("payment")) {
      setView("orders");
      notify("Payment return received. Verify the payment from your order.");
    }
  }, []);
  useEffect(() => {
    if (ready) {
      localStorage.setItem("ahiakom-cart", JSON.stringify(cart));
      localStorage.setItem("ahiakom-wishlist", JSON.stringify(wishlist));
    }
  }, [cart, wishlist, ready]);
  useEffect(() => {
    if (user) {
      api("cart")
        .then((d) => {
          if (d.items.length)
            setCart(
              Object.fromEntries(
                d.items.map((i: any) => [i.productId, i.quantity]),
              ),
            );
        })
        .catch(() => {});
      api("wishlist")
        .then((d) => setWishlist(d.ids))
        .catch(() => {});
    }
  }, [user?.id]);
  useEffect(() => {
    if (view === "orders" && user)
      api("orders")
        .then((d) => setOrders(d.orders))
        .catch((e) => setError(e.message));
  }, [view, user]);
  useEffect(() => {
    setPage(1);
  }, [query, category, sort, view, onlyStock, maxPrice]);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (modal && !d.open) d.showModal();
    else if (!modal && d.open) d.close();
    setError("");
  }, [modal]);
  function changeCart(next: Basket) {
    setCart(next);
    checkoutKey.current = crypto.randomUUID();
    if (user)
      cartWrites.current = cartWrites.current
        .then(() =>
          api("cart", "PUT", {
            items: Object.entries(next).map(([productId, quantity]) => ({
              productId,
              quantity,
            })),
          }),
        )
        .then(() => {})
        .catch((e) => notify(e.message));
  }
  function add(p: Product) {
    const qty = cart[p.id] ?? 0;
    if (qty >= Math.min(p.stock, 20)) {
      notify("Maximum available quantity reached");
      return;
    }
    changeCart({ ...cart, [p.id]: qty + 1 });
    notify("Added to your bag");
  }
  function quantity(id: string, delta: number) {
    const p = products.find((p) => p.id === id);
    const next = { ...cart };
    next[id] = (next[id] ?? 0) + delta;
    if (next[id] <= 0) delete next[id];
    else if (next[id] > Math.min(p?.stock ?? 20, 20)) return;
    changeCart(next);
  }
  async function wish(id: string) {
    if (user) {
      try {
        setWishlist((await api("wishlist", "POST", { productId: id })).ids);
      } catch (e: any) {
        notify(e.message);
      }
    } else
      setWishlist(
        wishlist.includes(id)
          ? wishlist.filter((v) => v !== id)
          : [...wishlist, id],
      );
  }
  function browse(cat = "") {
    setView("home");
    setCategory(cat);
    setQuery("");
    setTimeout(
      () => catalogRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }
  const lines = products
    .filter((p) => cart[p.id])
    .map((p) => ({ ...p, quantity: cart[p.id] }));
  const count = Object.values(cart).reduce((s, n) => s + n, 0);
  const subtotal = lines.reduce((s, p) => s + p.price * p.quantity, 0);
  const shipping = new Set(lines.map((p) => p.supplier_id)).size * 250000;
  let filtered = products.filter(
    (p) =>
      (!category || p.category_id === category) &&
      (!query ||
        (p.name + " " + p.seller + " " + p.brand)
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (view !== "wishlist" || wishlist.includes(p.id)) &&
      (view !== "deals" || p.original > p.price) &&
      (!onlyStock || p.available) &&
      (!maxPrice || p.price <= Number(maxPrice) * 100),
  );
  if (sort === "price-asc") filtered.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") filtered.sort((a, b) => b.price - a.price);
  if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function auth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    await run(async () => {
      const result = await api(
        register ? "auth/register" : "auth/login",
        "POST",
        d,
      );
      setUser(result.user);
      setModal(null);
      notify("Welcome to Ahiakom, " + result.user.name);
    });
  }
  async function checkout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = Object.fromEntries(new FormData(e.currentTarget));
    await run(async () => {
      const result = await api("orders", "POST", {
        items: lines.map((p) => ({ productId: p.id, quantity: p.quantity })),
        address,
        key: checkoutKey.current,
      });
      setOrders((await api("orders")).orders);
      setModal(null);
      setView("orders");
      notify("Demonstration order created. Choose a payment test below.");
      await refresh();
    });
  }
  async function orderAction(o: any, action: string, data?: any) {
    await run(async () => {
      const r = await api(`orders/${o.id}/${action}`, "POST", data ?? {});
      if (r.url) {
        const u = new URL(r.url);
        if (u.protocol === "https:" && u.hostname === "checkout.paystack.com")
          location.assign(r.url);
        else throw new Error("Unexpected payment URL");
        return;
      }
      if (["demo-pay", "verify"].includes(action)) changeCart({});
      setOrders((await api("orders")).orders);
      await refresh();
      notify("Order updated");
    });
  }
  const brand = (
    <span className="wordmark">
      <span className="brand-icon">
        <ShoppingBag size={24} />
      </span>
      ahia<span className="gold">kom</span>
    </span>
  );
  return (
    <>
      <a className="skip" href="#catalog">
        Skip to products
      </a>
      <div className="announcement">
        <span>
          Welcome to the Ahiakom development preview <b>•</b> Sample products.
          No live purchases.
        </span>
        <button
          onClick={() => {
            setView("orders");
            if (!user) setModal("auth");
          }}
        >
          Track an order <ArrowRight size={12} />
        </button>
      </div>
      <header>
        <div className="header-inner">
          <button
            className="brand-button"
            aria-label="Ahiakom home"
            onClick={() => {
              setView("home");
              setCategory("");
              setQuery("");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {brand}
          </button>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              browse(category);
              setQuery(
                (
                  e.currentTarget.elements.namedItem(
                    "search",
                  ) as HTMLInputElement
                ).value,
              );
            }}
          >
            <input
              name="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setView("home");
              }}
              placeholder="What are you looking for today?"
              aria-label="Search products"
            />
            <button aria-label="Search">
              <Search size={21} />
            </button>
          </form>
          <div className="header-actions">
            <button
              onClick={() => (user ? setView("account") : setModal("auth"))}
            >
              <UserRound />
              <span>
                <small>
                  {user ? "Hello, " + user.name.split(" ")[0] : "Welcome back"}
                </small>
                {user ? "My account" : "Sign in / Register"}
              </span>
            </button>
            <button aria-label="Wishlist" onClick={() => setView("wishlist")}>
              <Heart />
              <span className="action-label">Wishlist</span>
            </button>
            <button
              onClick={() => setModal("cart")}
              aria-label={"Shopping cart, " + count + " items"}
            >
              <span className="cart-icon">
                <ShoppingCart />
                <i>{count}</i>
              </span>
              <span className="action-label">Cart</span>
            </button>
          </div>
        </div>
        <nav className="desktop-nav">
          <button
            className="category-nav"
            onClick={() => setModal("categories")}
          >
            <Menu size={18} /> All categories <ChevronDown size={16} />
          </button>
          <button
            className={view === "home" ? "active" : ""}
            onClick={() => {
              setView("home");
              setCategory("");
              setQuery("");
            }}
          >
            Home
          </button>
          <button
            className={view === "deals" ? "active" : ""}
            onClick={() => {
              setView("deals");
              setCategory("");
            }}
          >
            Deals
          </button>
          <button
            onClick={() => {
              browse();
              setSort("featured");
            }}
          >
            New arrivals
          </button>
          <button onClick={() => setModal("brands")}>Top brands</button>
          <button onClick={() => setModal("mall")}>Ahiakom Mall</button>
          <button
            className="seller-link"
            onClick={() => (user ? setView("seller") : setModal("auth"))}
          >
            <Store size={16} /> Become a seller <ArrowRight size={15} />
          </button>
        </nav>
      </header>
      <main className="container">
        {view === "home" && !query && !category && (
          <>
            <div className="hero-row">
              <aside className="category-side">
                {categories.slice(0, 10).map((c, i) => {
                  const Icon = icons[i];
                  return (
                    <button key={c.id} onClick={() => browse(c.id)}>
                      <Icon size={17} />
                      <span>{c.name}</span>
                      <ChevronRight size={13} />
                    </button>
                  );
                })}
                <button onClick={() => setModal("categories")}>
                  <LayoutGrid size={17} />
                  <span>More categories</span>
                  <ChevronRight size={13} />
                </button>
              </aside>
              <section
                className="hero"
                onTouchStart={(e) =>
                  (initialTouch.current = e.touches[0].clientX)
                }
                onTouchEnd={(e) => {
                  if (
                    Math.abs(
                      e.changedTouches[0].clientX - initialTouch.current,
                    ) > 40
                  )
                    setSlide(slide ? 0 : 1);
                }}
              >
                <div className="hero-copy">
                  <span className="eyebrow">
                    <span /> YOUR EVERYDAY, UPGRADED
                  </span>
                  <h1>
                    {slide ? "Little things." : "One Market."}
                    <br />
                    <em>
                      {slide ? "Beautiful living." : "Endless Possibilities."}
                    </em>
                  </h1>
                  <p>
                    {slide
                      ? "Find thoughtful essentials for your home and everything in between."
                      : "A world of discoveries, closer to home. Explore electronics, everyday essentials and more."}
                  </p>
                  <button
                    className="gold-button"
                    onClick={() => browse(slide ? "cat-3" : "")}
                  >
                    Shop now <ArrowRight size={18} />
                  </button>
                  <small>Explore our demonstration collection</small>
                </div>
                <div
                  className="hero-art"
                  aria-label="Illustrated headphones, phone and smartwatch"
                >
                  <div className="orbit" />
                  <div className="plinth" />
                  <img
                    className="hero-phone"
                    src="/products/phone.svg"
                    alt="Smartphone concept illustration"
                  />
                  <img
                    className="hero-headphones"
                    src="/products/headphones.svg"
                    alt="Headphones concept illustration"
                  />
                  <img
                    className="hero-watch"
                    src="/products/watch.svg"
                    alt="Smartwatch concept illustration"
                  />
                  <span className="floating-label">
                    <Sparkles size={14} /> A little more possibility.
                  </span>
                </div>
                <div className="slide-controls">
                  {[0, 1].map((i) => (
                    <button
                      key={i}
                      className={slide === i ? "selected" : ""}
                      aria-label={"Promotion " + (i + 1)}
                      aria-pressed={slide === i}
                      onClick={() => setSlide(i)}
                    />
                  ))}
                </div>
                <span className="hero-edition">
                  THE EVERYDAY COLLECTION / 01
                </span>
              </section>
            </div>
            <section
              className="trust-strip"
              aria-label="Marketplace preview policies"
            >
              {[
                [Truck, "Delivery across Nigeria", "Options being developed"],
                [ShieldCheck, "Secure payment flow", "Sandbox & simulation"],
                [RotateCcw, "Clear return terms", "Policies before launch"],
                [Store, "Seller verification", "Approval workflow"],
                [Headphones, "Here to help", "Preview support guide"],
              ].map(([Icon, title, sub]: any) => (
                <button key={title} onClick={() => setModal("policies")}>
                  <Icon size={25} />
                  <span>
                    <strong>{title}</strong>
                    <small>{sub}</small>
                  </span>
                </button>
              ))}
            </section>
            <section className="category-section">
              <div className="section-heading">
                <div>
                  <span className="overline">FIND YOUR NEXT FAVOURITE</span>
                  <h2>Explore the aisles</h2>
                </div>
                <button onClick={() => setModal("categories")}>
                  All categories <ArrowRight size={16} />
                </button>
              </div>
              <div className="category-tiles">
                {[
                  ["cat-0", "phone", "Phones & tablets"],
                  ["cat-1", "laptop", "Computers"],
                  ["cat-2", "headphones", "Electronics"],
                  ["cat-3", "blender", "Home & kitchen"],
                  ["cat-4", "sneakers", "Fashion"],
                  ["cat-5", "beauty", "Beauty"],
                  ["cat-6", "dumbbell", "Sports & fitness"],
                  ["cat-11", "bag", "More to explore"],
                ].map(([id, img, name]) => (
                  <button
                    key={id}
                    onClick={() =>
                      id === "cat-11" ? setModal("categories") : browse(id)
                    }
                  >
                    <div>
                      <img
                        src={"/products/" + img + ".svg"}
                        alt=""
                        loading="lazy"
                      />
                    </div>
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
        {["home", "wishlist", "deals"].includes(view) && (
          <section className="catalog-section" id="catalog" ref={catalogRef}>
            <div className="section-heading">
              <div>
                <span className="overline">
                  {view === "wishlist"
                    ? "SAVED FOR LATER"
                    : "CURATED FOR YOUR EVERYDAY"}
                </span>
                <h2>
                  {view === "wishlist"
                    ? "Your wishlist"
                    : view === "deals"
                      ? "Promotional offers"
                      : query
                        ? "Results for “" + query + "”"
                        : (categories.find((c) => c.id === category)?.name ??
                          "Discover something good")}
                </h2>
              </div>
              <span className="sample-label">DEMO COLLECTION</span>
            </div>
            <div className="catalog-tools">
              <span>{filtered.length} products</span>
              <label>
                <input
                  type="checkbox"
                  checked={onlyStock}
                  onChange={(e) => setOnlyStock(e.target.checked)}
                />{" "}
                Available samples
              </label>
              <label className="max-price">
                Up to ₦{" "}
                <input
                  type="number"
                  min="0"
                  aria-label="Maximum price in naira"
                  placeholder="Any"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </label>
              <label className="sort">
                <SlidersHorizontal size={15} />
                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </label>
            </div>
            {category && (
              <button className="filter-chip" onClick={() => setCategory("")}>
                {categories.find((c) => c.id === category)?.name}
                <X size={13} />
              </button>
            )}
            <div className="product-grid">
              {filtered.slice((page - 1) * 8, page * 8).map((p) => (
                <article className="product-card" key={p.id}>
                  <div className="product-image">
                    <button
                      className="image-open"
                      aria-label={"View " + p.name}
                      onClick={() => {
                        setSelected(p);
                        setModal("product");
                      }}
                    >
                      <img
                        src={p.image}
                        alt={p.name + " — concept illustration"}
                        loading="lazy"
                      />
                    </button>
                    <span className="product-tag">
                      {p.available ? "Sample" : "Unavailable"}
                    </span>
                    <button
                      className={
                        "wish " + (wishlist.includes(p.id) ? "saved" : "")
                      }
                      onClick={() => wish(p.id)}
                      aria-label={
                        (wishlist.includes(p.id) ? "Remove from" : "Add to") +
                        " wishlist: " +
                        p.name
                      }
                    >
                      <Heart
                        size={17}
                        fill={wishlist.includes(p.id) ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                  <div className="product-copy">
                    <small>{p.seller}</small>
                    <button
                      className="product-title"
                      onClick={() => {
                        setSelected(p);
                        setModal("product");
                      }}
                    >
                      {p.name}
                    </button>
                    <p className="product-price">
                      {money(p.price)}{" "}
                      {p.original > p.price && <del>{money(p.original)}</del>}
                    </p>
                    <div className="product-bottom">
                      <span>No reviews yet</span>
                      <button
                        disabled={!p.available}
                        aria-label={"Add " + p.name + " to cart"}
                        onClick={() => add(p)}
                      >
                        <Plus size={18} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!filtered.length && (
              <div className="empty-state">
                <ShoppingBag size={36} />
                <h3>
                  {loaded ? "Nothing here just yet" : "Loading the collection…"}
                </h3>
                <p>
                  {view === "deals"
                    ? "No promotional discounts are configured. Explore the sample collection."
                    : "Try another search or browse all categories."}
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    browse();
                    setOnlyStock(false);
                    setMaxPrice("");
                  }}
                >
                  Browse collection
                </button>
              </div>
            )}
            {filtered.length > 8 && (
              <div className="pagination">
                <button
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ArrowLeft size={16} />
                </button>
                <span>
                  Page {page} of {Math.ceil(filtered.length / 8)}
                </span>
                <button
                  aria-label="Next page"
                  disabled={page >= Math.ceil(filtered.length / 8)}
                  onClick={() => setPage(page + 1)}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
        {view === "home" && !query && !category && (
          <section className="seller-banner">
            <div>
              <span className="overline">GROW WITH AHIAKOM</span>
              <h2>
                Your business.
                <br />A bigger marketplace.
              </h2>
              <p>
                Bring your products to a new audience.
                <br />
                Apply to join our future seller community.
              </p>
              <button
                className="primary"
                onClick={() => (user ? setView("seller") : setModal("auth"))}
              >
                Start selling <ArrowRight size={17} />
              </button>
            </div>
            <div className="seller-art">
              <ShoppingBag size={120} strokeWidth={0.8} />
              <span>
                <Leaf size={22} /> Made for possibility.
              </span>
            </div>
            <div className="seller-note">
              <strong>
                Independent sellers.
                <br />
                One connected market.
              </strong>
              <p>
                Direct vendor onboarding is open for testing. Applications
                require administrator approval.
              </p>
            </div>
          </section>
        )}
        {view === "account" && (
          <section className="panel">
            <h1>Your Ahiakom</h1>
            {user ? (
              <>
                <p>
                  {user.name} · {user.email}
                </p>
                <div className="button-row">
                  <button className="primary" onClick={() => setView("orders")}>
                    My orders
                  </button>
                  <button onClick={() => setView("wishlist")}>Wishlist</button>
                  <button onClick={() => setView("seller")}>
                    Seller portal
                  </button>
                  {["admin", "support"].includes(user.role) && (
                    <button onClick={() => setView("admin")}>
                      Administration
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await api("auth/logout", "POST", {});
                      setUser(null);
                      setCart({});
                      setWishlist([]);
                      setView("home");
                    }}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              </>
            ) : (
              <button className="primary" onClick={() => setModal("auth")}>
                Sign in
              </button>
            )}
          </section>
        )}
        {view === "orders" && (
          <section className="panel">
            <span className="overline">YOUR SHOPPING JOURNEY</span>
            <h1>Orders & tracking</h1>
            {!user ? (
              <button className="primary" onClick={() => setModal("auth")}>
                Sign in to see orders
              </button>
            ) : orders.length ? (
              orders.map((o) => (
                <article className="order-card" key={o.id}>
                  <div className="section-heading">
                    <div>
                      <small>
                        {new Date(o.created_at).toLocaleDateString()}
                      </small>
                      <h3>{o.id.slice(0, 11).toUpperCase()}</h3>
                    </div>
                    <span className="status">
                      {o.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {o.items.map((i: any) => (
                    <p key={i.id} className="between">
                      <span>
                        {i.quantity} × {i.name}
                      </span>
                      <strong>{money(i.price_kobo * i.quantity)}</strong>
                    </p>
                  ))}
                  <p className="between">
                    <span>Shipping estimate</span>
                    {money(o.shipping_kobo)}
                  </p>
                  <p className="between">
                    <strong>Total</strong>
                    <strong>{money(o.total_kobo)}</strong>
                  </p>
                  <small>
                    {o.payment.provider === "simulated"
                      ? "Simulation — no money moves"
                      : "Paystack test transaction"}{" "}
                    · Payment: {o.payment.status}
                  </small>
                  <div className="fulfilment-list">
                    {o.fulfilments.map((f: any) => (
                      <div key={f.id}>
                        <Truck size={17} />
                        <span>
                          {f.seller}
                          <small>
                            {f.status.replaceAll("_", " ")}
                            {f.tracking ? " · " + f.tracking : ""}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="button-row">
                    {o.status === "pending_payment" && (
                      <>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            orderAction(
                              o,
                              o.payment.provider === "simulated"
                                ? "demo-pay"
                                : "pay",
                            )
                          }
                        >
                          {o.payment.provider === "simulated"
                            ? "Simulate successful payment"
                            : "Pay with Paystack test"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => orderAction(o, "cancel")}
                        >
                          Cancel order
                        </button>
                      </>
                    )}
                    {o.payment.provider === "paystack" && (
                      <button
                        disabled={busy}
                        onClick={() => orderAction(o, "verify")}
                      >
                        Verify payment
                      </button>
                    )}
                    {o.status === "delivered" && !o.returns?.length && (
                      <button
                        onClick={() => {
                          setSelected(o);
                          setModal("return");
                        }}
                      >
                        Request return
                      </button>
                    )}
                    {o.payment.status === "success" && !o.refunds.length && (
                      <button
                        onClick={() => {
                          setSelected(o);
                          setModal("refund");
                        }}
                      >
                        Request refund
                      </button>
                    )}
                  </div>
                  {o.returns?.map((r: any) => (
                    <p key={r.id}>
                      Return: {r.status}
                      {r.note ? " · " + r.note : ""}
                    </p>
                  ))}
                  {o.refunds.map((r: any) => (
                    <p key={r.id}>
                      Refund: {money(r.amount_kobo)} · {r.status}
                    </p>
                  ))}
                </article>
              ))
            ) : (
              <div className="empty-state">
                <Package />
                <h3>No orders yet</h3>
                <p>Your demonstration orders will appear here.</p>
                <button className="primary" onClick={() => browse()}>
                  Explore products
                </button>
              </div>
            )}
          </section>
        )}
        {view === "seller" &&
          (user?.role === "supplier" ? (
            <Dashboard
              type="supplier"
              categories={categories}
              notify={notify}
            />
          ) : (
            <section className="panel narrow">
              <span className="overline">PARTNER WITH AHIAKOM</span>
              <h1>Build your next chapter.</h1>
              <p>
                Register your business for manual review. This preview does not
                verify documents automatically.
              </p>
              {!user ? (
                <button className="primary" onClick={() => setModal("auth")}>
                  Create an account to apply
                </button>
              ) : user.role === "customer" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    run(async () => {
                      await api("supplier/apply", "POST", data);
                      setUser((await api("auth/me")).user);
                      notify("Application submitted for review");
                    });
                  }}
                >
                  <label>
                    Business name
                    <input name="name" required minLength={3} />
                  </label>
                  <label>
                    Business registration reference
                    <input name="registration" required minLength={3} />
                  </label>
                  <p className="muted">
                    Use fictitious information during testing. Do not upload
                    identity documents.
                  </p>
                  <button className="primary" disabled={busy}>
                    Submit application <ArrowRight size={17} />
                  </button>
                </form>
              ) : (
                <p>Use a customer account to test supplier onboarding.</p>
              )}
            </section>
          ))}
        {view === "support" &&
          (user ? (
            <Support />
          ) : (
            <section className="panel">
              <h1>Customer support</h1>
              <button className="primary" onClick={() => setModal("auth")}>
                Sign in to send a request
              </button>
            </section>
          ))}
        {view === "admin" && (
          <Dashboard type="admin" categories={categories} notify={notify} />
        )}
        {error && !modal && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
      </main>
      <footer>
        <div className="footer-main">
          <div>
            {brand}
            <p>One Market. Endless Possibilities.</p>
            <small>A Nigerian marketplace, built for what’s next.</small>
          </div>
          <div>
            <strong>Explore Ahiakom</strong>
            <button onClick={() => browse()}>Shop the collection</button>
            <button onClick={() => setView("seller")}>Become a seller</button>
            <button onClick={() => setView("orders")}>Track an order</button>
          </div>
          <div>
            <strong>Good to know</strong>
            <button onClick={() => setModal("policies")}>
              Delivery & returns
            </button>
            <button onClick={() => setModal("privacy")}>Privacy & terms</button>
            <button onClick={() => setView("support")}>Customer support</button>
          </div>
          <div className="footer-note">
            <span className="sample-label">DEVELOPMENT PREVIEW</span>
            <p>
              Illustrative products and test inventory.
              <br />
              No live payments or fulfilment.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Ahiakom. All possibilities ahead.
          </span>
          <span>
            Designed for Nigeria <span className="flag">▌▐</span>
          </span>
        </div>
      </footer>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[
          [
            Home,
            "Home",
            () => {
              setView("home");
              setQuery("");
              setCategory("");
              window.scrollTo(0, 0);
            },
          ],
          [LayoutGrid, "Categories", () => setModal("categories")],
          [Tag, "Deals", () => setView("deals")],
          [ShoppingCart, "Cart", () => setModal("cart")],
          [
            UserRound,
            "Account",
            () => (user ? setView("account") : setModal("auth")),
          ],
        ].map(([Icon, label, fn]: any) => (
          <button key={label} onClick={fn}>
            <Icon size={21} />
            <span>
              {label}
              {label === "Cart" && count ? " (" + count + ")" : ""}
            </span>
          </button>
        ))}
      </nav>
      <dialog
        ref={dialogRef}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
        className={modal === "cart" ? "drawer" : "dialog"}
      >
        <div className="dialog-inner">
          <button
            className="close"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
          {modal === "cart" && (
            <>
              <span className="overline">GOOD FINDS, ALL TOGETHER</span>
              <h2>
                Your shopping bag <small>({count})</small>
              </h2>
              {lines.length ? (
                <>
                  <div className="cart-lines">
                    {lines.map((p) => (
                      <div className="cart-line" key={p.id}>
                        <img src={p.image} alt="" />
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.seller}</small>
                          <b>{money(p.price)}</b>
                          <div className="quantity">
                            <button
                              aria-label={"Decrease " + p.name}
                              onClick={() => quantity(p.id, -1)}
                            >
                              <Minus size={13} />
                            </button>
                            <span>{p.quantity}</span>
                            <button
                              aria-label={"Increase " + p.name}
                              onClick={() => quantity(p.id, 1)}
                            >
                              <Plus size={13} />
                            </button>
                            <button
                              className="remove"
                              onClick={() => {
                                const next = { ...cart };
                                delete next[p.id];
                                changeCart(next);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="cart-summary">
                    <p className="between">
                      <span>Subtotal</span>
                      <strong>{money(subtotal)}</strong>
                    </p>
                    <p className="between">
                      <span>Demo delivery estimate</span>
                      {money(shipping)}
                    </p>
                    <p className="between total">
                      <span>Total</span>
                      {money(subtotal + shipping)}
                    </p>
                    <p className="muted">
                      ₦2,500 per seller for this demonstration. Tax treatment
                      and actual delivery rates await approval.
                    </p>
                    <button
                      className="primary full"
                      onClick={() =>
                        user ? setModal("checkout") : setModal("auth")
                      }
                    >
                      {user
                        ? "Continue to test checkout"
                        : "Sign in to checkout"}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <ShoppingBag size={40} />
                  <h3>Your next discovery awaits.</h3>
                  <button
                    className="primary"
                    onClick={() => {
                      setModal(null);
                      browse();
                    }}
                  >
                    Explore products
                  </button>
                </div>
              )}
            </>
          )}
          {modal === "auth" && (
            <>
              <span className="overline">WELCOME TO YOUR MARKETPLACE</span>
              <h2>
                {register ? "Create your account" : "Good to see you again."}
              </h2>
              <p className="muted">
                Use test details during the development preview.
              </p>
              <form onSubmit={auth}>
                {register && (
                  <label>
                    Your name
                    <input
                      name="name"
                      required
                      minLength={2}
                      autoComplete="name"
                    />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={register ? 12 : 1}
                    maxLength={128}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                  />
                </label>
                {register && <small>At least 12 characters.</small>}
                <button disabled={busy} className="primary full">
                  {busy
                    ? "Please wait…"
                    : register
                      ? "Create account"
                      : "Sign in"}
                  <ArrowRight size={16} />
                </button>
              </form>
              <button
                className="text-button"
                onClick={() => setRegister(!register)}
              >
                {register
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
            </>
          )}
          {modal === "checkout" && (
            <>
              <span className="overline">TEST CHECKOUT</span>
              <h2>Where should it go?</h2>
              <p className="muted">
                No real shipment will be created. Use a fictitious address.
              </p>
              <form onSubmit={checkout}>
                <label>
                  Recipient name
                  <input
                    name="name"
                    required
                    minLength={2}
                    defaultValue={user?.name}
                  />
                </label>
                <label>
                  Phone number
                  <input name="phone" type="tel" required minLength={10} />
                </label>
                <label>
                  Street address
                  <input name="address" required minLength={5} />
                </label>
                <div className="two-col">
                  <label>
                    City
                    <input name="city" required minLength={2} />
                  </label>
                  <label>
                    State
                    <input name="state" required minLength={2} />
                  </label>
                </div>
                <p className="between total">
                  <span>Order total</span>
                  {money(subtotal + shipping)}
                </p>
                <p className="muted">
                  Final prices and stock are checked by the server. You can
                  review the resulting order before the payment test.
                </p>
                <button
                  className="primary full"
                  disabled={busy || !lines.length}
                >
                  {busy ? "Creating order…" : "Create test order"}
                  <ArrowRight size={17} />
                </button>
              </form>
            </>
          )}
          {modal === "product" && selected && (
            <>
              <div className="detail-image">
                <img
                  src={selected.image}
                  alt={selected.name + " concept illustration"}
                />
              </div>
              <span className="overline">DEMONSTRATION PRODUCT</span>
              <h2>{selected.name}</h2>
              <p className="product-price">{money(selected.price)}</p>
              <p>{selected.description}</p>
              {selected.group_key && (
                <div className="button-row">
                  {products
                    .filter(
                      (p) =>
                        p.group_key === selected.group_key &&
                        p.supplier_id === selected.supplier_id,
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        aria-pressed={p.id === selected.id}
                        onClick={() => setSelected(p)}
                      >
                        {p.variant_label || p.name}
                      </button>
                    ))}
                </div>
              )}
              <dl>
                <dt>Seller</dt>
                <dd>{selected.seller}</dd>
                <dt>Availability</dt>
                <dd>
                  {selected.available
                    ? selected.stock + " sample units"
                    : "Unavailable"}
                </dd>
                <dt>Delivery</dt>
                <dd>Estimate shown at checkout; no real shipment.</dd>
                <dt>Returns</dt>
                <dd>Test refund requests available after simulated payment.</dd>
                <dt>Reviews</dt>
                <dd>No customer reviews.</dd>
              </dl>
              <button
                className="primary full"
                disabled={!selected.available}
                onClick={() => add(selected)}
              >
                Add to bag <Plus size={17} />
              </button>
            </>
          )}
          {modal === "categories" && (
            <>
              <h2>Every aisle. More possibility.</h2>
              <div className="category-dialog">
                {categories.map((c, i) => {
                  const Icon = icons[i % icons.length];
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        browse(c.id);
                        setModal(null);
                      }}
                    >
                      <Icon size={21} />
                      {c.name}
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {modal === "return" && selected && (
            <>
              <h2>Request a return</h2>
              <p>
                Returns require administrator review. No actual collection is
                arranged in this preview.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = Object.fromEntries(new FormData(e.currentTarget));
                  run(async () => {
                    await api("orders/return", "POST", {
                      orderId: selected.id,
                      reason: d.reason,
                    });
                    setOrders((await api("orders")).orders);
                    setModal(null);
                    notify("Return request submitted");
                  });
                }}
              >
                <label>
                  Reason
                  <textarea name="reason" minLength={5} required />
                </label>
                <button className="primary" disabled={busy}>
                  Submit return request
                </button>
              </form>
            </>
          )}
          {modal === "refund" && selected && (
            <>
              <h2>Request a refund</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = Object.fromEntries(new FormData(e.currentTarget));
                  run(async () => {
                    await api("orders/" + selected.id + "/refund", "POST", {
                      amount_kobo: Math.round(Number(d.amount) * 100),
                      reason: d.reason,
                    });
                    setOrders((await api("orders")).orders);
                    setModal(null);
                    notify("Refund request submitted");
                  });
                }}
              >
                <label>
                  Amount in naira
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Reason
                  <textarea name="reason" minLength={5} required />
                </label>
                <button className="primary" disabled={busy}>
                  Submit request
                </button>
              </form>
            </>
          )}
          {["policies", "privacy", "support", "brands", "mall"].includes(
            modal ?? "",
          ) && (
            <>
              <span className="overline">AHIAKOM PREVIEW</span>
              <h2>
                {
                  {
                    policies: "Shopping with confidence",
                    privacy: "Your information matters",
                    support: "How can we help?",
                    brands: "A home for great brands",
                    mall: "Meet Ahiakom Mall",
                  }[modal!]
                }
              </h2>
              <p>
                {
                  {
                    policies:
                      "This is a development environment. Products, inventory and delivery charges are samples. No delivery promises, warranty commitments or live fulfilment are offered. Final returns and delivery policies must be approved before launch.",
                    privacy:
                      "Use fictitious personal information for testing. Account details, hashed passwords, delivery addresses and order records are stored to demonstrate the marketplace. Payment card information is never stored. A production privacy notice, retention schedule and data request process are required before launch.",
                    support:
                      "For this preview, you can track test orders from My Account, cancel unpaid orders and request refunds on confirmed test payments. Live chat, email delivery and staffed customer support are not connected.",
                    brands:
                      "No brand partnerships have been established. All current listings are generic demonstration products. Approved brands can be added after commercial agreements and product permissions are confirmed.",
                    mall: "A future curated destination for approved stores and brands. It is not yet open, and no supplier partnerships are implied by this preview.",
                  }[modal!]
                }
              </p>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
