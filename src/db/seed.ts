import { escrows } from "./schema";
import { drizzle } from "drizzle-orm/neon-http";
import { NeonQueryFunction, neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql: NeonQueryFunction<boolean, boolean> = neon(
  process.env.DATABASE_URL!,
);

const db = drizzle(sql, {
  schema,
});

const main = async () => {
  try {
    console.log("Seeding database");
    // Delete all data
    await db.delete(escrows);

    // await db.insert(escrows).values([
    //   {
    //     id: 1,
    //     objectID: "0x1234",
    //     owner: "0x12345",
    //     frequency: 30,
    //     lastClaimed: 1,
    //     filledOrders: 3,
    //     balanceX: 100,
    //     balanceY: 200,
    //     decimalsX: 6,
    //     decimalsY: 6,
    //     priceEnabled: false,
    //     minPrice: 0,
    //     maxPrice: 0,
    //     depositTime: 0,
    //     endTime: 0,
    //     totalSpent: 300,
    //     totalWithdrawnAmount: 70,
    //   },
    // ]);
    console.log("Seeding completed");
  } catch (error) {
    console.error(error);
    throw new Error("Failed to seed database");
  }
};

main();
