import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { database, type DB } from "./db";
const scrypt = promisify(scryptCallback);
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type User = {
  id: string;
  email: string;
  name: string;
  role: "customer" | "supplier" | "admin" | "support";
};
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ":" + key.toString("hex");
}
export async function checkPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export async function session(db: DB, userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.query("INSERT INTO sessions VALUES($1,$2,NOW()+INTERVAL '7 days')", [
    digest(token),
    userId,
  ]);
  return token;
}
export async function currentUser(req: Request): Promise<User | null> {
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)ahiakom_session=([^;]+)/)?.[1];
  if (!token) return null;
  const db = await database();
  return (
    (
      await db.query<User>(
        "SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",
        [digest(token)],
      )
    ).rows[0] ?? null
  );
}
export async function requireUser(req: Request, roles?: string[]) {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, "Please sign in to continue");
  if (roles && !roles.includes(u.role))
    throw new HttpError(403, "Access denied");
  return u;
}
export async function rateLimit(key: string, max = 30) {
  const db = await database();
  const r = await db.query<{ count: number }>(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,NOW()+INTERVAL '10 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<NOW() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at<NOW() THEN NOW()+INTERVAL '10 minutes' ELSE rate_limits.expires_at END RETURNING count",
    [key],
  );
  if (r.rows[0].count > max)
    throw new HttpError(
      429,
      "Too many attempts. Please try again in 10 minutes.",
    );
}
export function checkOrigin(req: Request) {
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const expected = process.env.APP_ORIGIN ?? new URL(req.url).origin;
    if (!origin || origin !== expected)
      throw new HttpError(403, "Request origin rejected");
  }
}
