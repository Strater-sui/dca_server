import {
  Ed25519Keypair,
  Ed25519PublicKey,
} from "@mysten/sui.js/keypairs/ed25519";
import { CronJob } from "cron";
import * as fs from 'fs';
import { DCAServer } from "./server";

import { logger } from "./lib/logger";
const lockFilePath = 'task.lock';

// (async () => {
//   dotenv.config();
//   const keypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE!);
//   const dcaServer = new DCAServer(keypair);
//   dcaServer.loop(604800000, 1000); // one week
// })();

const keypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE!);
const dcaServer = new DCAServer(keypair);

console.log("Server Start");

unlock();
const job = new CronJob("*/1 * * * * *", async function () {
  if (isLocked()) {
    console.log('Task is already running, skipping.');
    return;
  }

  try {
    lock();
    logger.debug(`Running`);
    await dcaServer.checkpoint();
  } catch (error) {
    logger.error(error);
  } finally {
    unlock();
  }
});

function isLocked(): boolean {
  return fs.existsSync(lockFilePath);
}

function lock(): void {
  fs.writeFileSync(lockFilePath, '');
}

function unlock(): void {
  if (fs.existsSync(lockFilePath)) {
    fs.unlinkSync(lockFilePath);
  }
}

console.log("After job instantiation");
job.start();
