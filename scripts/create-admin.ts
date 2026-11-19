import { database } from "../lib/db";
import { hashPassword } from "../lib/auth";
const email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in the environment.",
  );
const db = await database();
await db.query(
  "INSERT INTO users(id,email,name,password,role) VALUES($1,$2,'Administrator',$3,'admin') ON CONFLICT(email) DO NOTHING",
  [crypto.randomUUID(), email.toLowerCase(), await hashPassword(password)],
);
console.log("Administrator created if email was unused.");
process.exit(0);
