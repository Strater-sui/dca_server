import * as dotenv from "dotenv";
dotenv.config();

export const SENTIO_SQL_URL = process.env.SENTIO_SQL_URL || "";
export const SENTIO_API_KEY = process.env.SENTIO_API_KEY || "";

export const DUMMY_ADDRESS =
  "0x0c434f35a9b9a569e4f6476b6d1dafcc767de25f3d143e864e8ce319df85d052";

export const DECIMAL_PLACES = 4;
export const MAX_RETRY_COUNT = 10;
export const FLOAT_SCALING = 10 ** 9;
export const TIME_WINDOW = 1000 * 60 * 10;
export const CHUNK_SIZE = 10;
export const AF_SLIPPAGE = 0.005;

export const DCA_PACKAGE = process.env.DCA_PACKAGE || "";
export const DCA_PACKAGE_INITIAL_VERSION = Number(process.env.DCA_PACKAGE_INITIAL_VERSION || "0");
export const DCA_REG = process.env.DCA_REG || "";
export const DCA_CAP = "0xe3f6f77c32e2ec27670c1a6c282b8a6b0a7ebc56057077c9467c4383cb7c0b6f";