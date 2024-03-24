import {
  Ed25519Keypair,
  Ed25519PublicKey,
} from "@mysten/sui.js/keypairs/ed25519";
import { DCAServer } from "./lib/dca_server";
import { CronJob } from "cron";

import * as dotenv from "dotenv";
import { logger } from "./lib/logger";
import { check } from "drizzle-orm/mysql-core";
dotenv.config();

// (async () => {
//   dotenv.config();
//   const keypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE!);
//   const dcaServer = new DCAServer(keypair);
//   dcaServer.loop(604800000, 1000); // one week
// })();

const keypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE!);
const dcaServer = new DCAServer(keypair);

let idx = 0;

console.log("Server Start");
const job = new CronJob("*/1 * * * * *", async function () {
  try {
    console.log("\n");
    const currentTime = Math.floor(new Date().getTime() / 1000);
    logger.info({ currentTime });
    await dcaServer.checkpoint();
  } catch (error) {
    logger.warn({ error }, "error");
  }
});
console.log("After job instantiation");
job.start();
