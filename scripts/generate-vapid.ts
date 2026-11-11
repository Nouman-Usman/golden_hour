// node scripts/generate-vapid.ts
// Prints a new key pair for browser push. Paste the three lines into .env yourself.
// The private key is a secret: never commit it or share it.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:noumanmughal0123@gmail.com");
