import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { escrows } from "./schema";

const sql: NeonQueryFunction<boolean, boolean> = neon(
  process.env.DATABASE_URL!,
);

const db = drizzle(sql);

const main = async () => {
  try {
    // await db.delete(escrows);
    await migrate(db, {
      migrationsFolder: "src/db/migrations",
    });

    console.log("Migration successful");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

main();
