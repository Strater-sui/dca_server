import {
  Ed25519Keypair,
  Ed25519PublicKey,
} from "@mysten/sui.js/keypairs/ed25519";
import { DCAServer } from "./lib/dca_server";

(async () => {
  run_scripts();
})();

async function run_scripts() {
  // Keypair
  const keypair = Ed25519Keypair.deriveKeypair(process.env.ADMIN_PHRASE!);
  const dcaServer = new DCAServer(keypair);
  const args = process.argv.slice(2);
  const action = args[0];

  //args
  const escrowId = process.env.ESCROW_ID ?? "";
  try {
    console.log("calling...", action);
    switch (action) {
      case "socket":
        dcaServer.socket();
        break;
      case "seed_database":
        await dcaServer.seedDatabase();
        break;
      case "load_database":
        await dcaServer.loadDatabase();
        break;
      case "place_order":
        await dcaServer.moveCallplaceOrder(
          "USDC",
          "SUI",
          0.05, // when amount is below than 0.01, the route will fail
          30,
          3,
          // null,
          // null,
          1 / 2,
          1 / 1.5,
        );
        break;
      case "execute_order":
        await dcaServer.moveCallExectueOrder(escrowId, "USDC", "SUI");
        break;
      case "close_order":
        await dcaServer.moveCallCloseEscrow(escrowId, "USDC", "SUI");
        break;
      default:
        console.log("No valid action specified");
        break;
    }
  } catch (error) {
    console.log(error);
  }
}
