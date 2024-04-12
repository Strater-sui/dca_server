import { PrismaClient } from "@prisma/client";

declare global {
  declare module globalThis {
    var prisma: PrismaClient;
  }
}

export { };