import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const usersApi = read("app/api/users/route.ts");
assert.match(usersApi, /accountType:\s*\{\s*not:\s*"DRIVER"/);

const usersPage = read("app/(dashboard)/dashboard/users/page.tsx");
assert.equal((usersPage.match(/accountType:\s*\{\s*not:\s*"DRIVER"/g) ?? []).length, 2);

const middleware = read("middleware.ts");
assert.match(middleware, /loginUrl\.searchParams\.set\("portal", "driver"\)/);
assert.match(middleware, /pathname\.startsWith\('\/api\/'\) && !pathname\.startsWith\('\/api\/driver\/'\)/);

const loginRoute = read("app/api/auth/login/route.ts");
assert.match(loginRoute, /accountType === "DRIVER".*?"\/driver"/s);

const uploadPage = read("app/(authenticated)/driver/invoices/upload/page.tsx");
assert.doesNotMatch(uploadPage, /from ['"]next\/image['"]/);
assert.match(uploadPage, /<img\s+src=\{preview\}/);

const trackingProvider = read("components/driver/tracking-provider.tsx");
assert.match(trackingProvider, /typeof navigator !== "undefined" && navigator\.geolocation/);

console.log("driver portal safeguards: passed");
