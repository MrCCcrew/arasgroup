// Run once: node scripts/gen-vapid.mjs
// Then copy the output into your .env / .env.local file
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log(`VAPID_SUBJECT="mailto:admin@modern-bns.com"`);
console.log("# Paste these into .env.local:");
console.log(`VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
