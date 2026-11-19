import { migrate } from "../lib/db";
await migrate();
console.log("Schema migration completed.");
process.exit(0);
