import { expireReservations } from "../lib/operations";
import { dispatchOutbox } from "../lib/connectors";
const actor = {
  id: "system-maintenance",
  name: "Maintenance",
  email: "system@example.invalid",
  role: "admin" as const,
};
console.log(await expireReservations(actor));
console.log(await dispatchOutbox(actor.id));
process.exit(0);
