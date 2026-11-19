import { database, migrate } from "../../lib/db";
const db = await database();
if (process.argv[2] === "write") {
  await migrate();
  await db.query(
    "INSERT INTO categories(id,name) VALUES('persistence-probe','Persistence probe')",
  );
  console.log("Committed");
} else {
  const result = await db.query(
    "SELECT name FROM categories WHERE id='persistence-probe'",
  );
  if (result.rows[0]?.name !== "Persistence probe")
    throw new Error("Committed data did not survive process restart");
  console.log("Restored");
}
process.exit(0);
