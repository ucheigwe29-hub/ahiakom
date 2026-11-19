import { migrate, database } from "../lib/db";
import { hashPassword } from "../lib/auth";
export async function seed() {
  await migrate();
  const db = await database();
  const categories = [
    "Phones & Tablets",
    "Computers & Accessories",
    "Electronics",
    "Home & Kitchen",
    "Fashion & Lifestyle",
    "Beauty & Personal Care",
    "Sports & Fitness",
    "Baby & Kids",
    "Automotive",
    "Groceries & Household Essentials",
    "Office & Business Equipment",
    "More Categories",
  ];
  for (let i = 0; i < categories.length; i++)
    await db.query(
      "INSERT INTO categories VALUES($1,$2) ON CONFLICT DO NOTHING",
      ["cat-" + i, categories[i]],
    );
  await db.query(
    "INSERT INTO pricing_rules(id) VALUES('default') ON CONFLICT DO NOTHING",
  );
  for (const [id, name] of [
    ["demo-tech", "Circuit House · Demo"],
    ["demo-home", "Everyday Living · Demo"],
  ])
    await db.query(
      "INSERT INTO suppliers(id,name,status) VALUES($1,$2,'approved') ON CONFLICT DO NOTHING",
      [id, name],
    );
  const samples = [
    ["headphones", "Studio wireless headphones", 2, 37500, "demo-tech", 24],
    ["phone", "Nova smartphone · 128GB", 0, 175000, "demo-tech", 12],
    ["laptop", "Everyday laptop · 14 inch", 1, 350000, "demo-tech", 8],
    ["blender", "Countertop blender · 1.5L", 3, 23333, "demo-home", 18],
    ["watch", "Active smartwatch", 2, 30000, "demo-tech", 20],
    ["sneakers", "Everyday court sneakers", 4, 26666, "demo-home", 30],
    ["beauty", "Daily skincare essentials", 5, 12916, "demo-home", 16],
    ["speaker", "Portable wireless speaker", 2, 26666, "demo-tech", 14],
    ["bag", "Everyday canvas tote", 4, 10000, "demo-home", 22],
    ["dumbbell", "Training dumbbell pair", 6, 22500, "demo-home", 10],
    ["lamp", "Minimal desk lamp", 10, 15833, "demo-home", 11],
    ["bottle", "Insulated water bottle", 3, 10000, "demo-home", 0],
  ];
  for (const [id, name, cat, cost, sid, stock] of samples)
    await db.query(
      "INSERT INTO products(id,supplier_id,category_id,name,description,image,cost_kobo,stock) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
      [
        id,
        sid,
        "cat-" + cat,
        name,
        "Illustrative demonstration product for testing Ahiakom. Specifications, stock and prices are samples. No real supplier, delivery promise or customer reviews.",
        "/products/" + id + ".svg",
        Number(cost) * 100,
        stock,
      ],
    );
}
if (process.argv[1]?.endsWith("seed.ts"))
  seed()
    .then(() => {
      console.log("Schema migrated; demonstration catalogue seeded.");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
