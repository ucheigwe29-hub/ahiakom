# AHIAKOM owner and seller setup

## Install this update

Extract the ZIP. Copy the contents of its ahiakom folder into the local repository opened by GitHub Desktop → Repository → Show in Explorer. Replace matching files, review Changes, commit to main and push origin. Leave Render Root Directory empty for this repository layout. The existing start command must run db:seed or db:migrate before the app starts to install the photo table. Keep the payment settings already used on the public demo.

## Create the owner account on the hosted demo

Use a fresh owner email address that has never registered as a shopper or seller in this database. Keep the separate shopper account for testing. In Render, open the ahiakom web service, then Environment. Add ADMIN_EMAIL and ADMIN_PASSWORD. Use a unique password of 12–128 characters stored in your password manager. Choose Save only. Keep credentials out of screenshots, GitHub and chat.

In Settings → Build & Deploy, copy your current Start Command somewhere safe. For the Node web service created in this walkthrough, temporarily use the following command:

```sh
npm run db:seed && npm run admin:create && APP_ORIGIN="${APP_ORIGIN:-$RENDER_EXTERNAL_URL}" npm start -- --hostname 0.0.0.0 --port "$PORT"
```

Save and deploy. The command uses the service's existing PostgreSQL connection. If the owner email already belongs to a shopper or seller, choose a fresh address. Existing accounts retain their role and password.

Once Live, sign in to AHIAKOM with the owner email and password. Open My Account → Administration. Restore the original Start Command **first**. Remove ADMIN_EMAIL and ADMIN_PASSWORD from Environment and deploy the saved settings. The administrator account persists in the database. Confirm you can still sign in.

## Test the seller experience

In a second browser profile register a separate shopper, open Become a seller and submit a business application. As owner open Administration → Suppliers and approve it. As seller open the seller workspace → Products. Create a listing with a name, category, supplier cost, quantity, description and a JPEG, PNG or WebP photo. Under Your inventory edit the listing, replace the photo and save. Refresh the storefront and open the listing to check the customer-facing result.

One current photo per product is stored in PostgreSQL for this pilot. The browser scales photos before submission and the server decodes and re-encodes them as WebP. Include the photo table in database backups. External object storage, multiple-image galleries and staff media moderation remain future work. Seeded fictional vendors do not have seller logins. Create a listing using the approved test seller to exercise ownership controls.
