import sharp from "sharp";
import { HttpError } from "./auth";
import type { DB } from "./db";

export async function saveProductPhoto(tx: DB, id: string, encoded: string) {
  let data: Buffer;
  try {
    const raw = Buffer.from(encoded, "base64");
    const pipeline = sharp(raw, { limitInputPixels: 4000000 });
    const meta = await pipeline.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new Error();
    data = await pipeline
      .rotate()
      .resize({
        width: 960,
        height: 960,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new HttpError(400, "Please choose a valid JPEG, PNG or WebP photo.");
  }
  await tx.query(
    "INSERT INTO product_photos(product_id,data) VALUES($1,$2) ON CONFLICT(product_id) DO UPDATE SET data=EXCLUDED.data",
    [id, data],
  );
  await tx.query("UPDATE products SET image=$1 WHERE id=$2", [
    "/api/photos/" + id + "?v=" + crypto.randomUUID(),
    id,
  ]);
}
