import { z } from "zod";
import { database } from "../lib/db";
import { hashPassword } from "../lib/auth";

const email = z.email().max(200).parse(process.env.ADMIN_EMAIL?.trim().toLowerCase());
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12 || password.length > 128)
  throw new Error("Set ADMIN_PASSWORD to a unique password of 12–128 characters.");

const db = await database();
await db.transaction(async (tx) => {
  const created = await tx.query(
    "INSERT INTO users(id,email,name,password,role) VALUES($1,$2,'Administrator',$3,'admin') ON CONFLICT(email) DO NOTHING RETURNING id",
    [crypto.randomUUID(), email, await hashPassword(password)],
  );
  if (created.rows.length) return console.log("Administrator created.");
  const existing = await tx.query("SELECT role FROM users WHERE email=$1", [email]);
  if (existing.rows[0]?.role !== "admin")
    throw new Error("This email belongs to a shopper or seller. Use a fresh owner email.");
  console.log("An administrator already exists for this email. Its password is unchanged.");
});
process.exit(0);
