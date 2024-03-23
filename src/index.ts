import {
  Ed25519Keypair,
  Ed25519PublicKey,
} from "@mysten/sui.js/keypairs/ed25519";
import { DCAServer } from "./lib/dca_server";

import * as dotenv from "dotenv";
dotenv.config();

// (async () => {
//   dotenv.config();
//   const keypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE!);
//   const dcaServer = new DCAServer(keypair);
//   dcaServer.loop(604800000, 1000); // one week
// })();

const keypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE!);
const dcaServer = new DCAServer(keypair);
function run() {
  setTimeout(() => {
    dcaServer.checkpoint();
    run();
  }, 1000);
}

run();
