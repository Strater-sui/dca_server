# dca_server

Db migration & updates:
```bash
npx prisma generate
npx prisma db push
```

To install dependencies:

```bash
yarn install
```

To run:

```bash
yarn fallback
```

```bash
yarn start
```

## Scripts for test actions

# Place Order
npx ts-node src/script.ts --action place --input USDC --output SUI --amount 0.01 --orders 2 --frequency 60

# Execute Order
npx ts-node src/script.ts --action execute --escrowId 0xaa75d8bef4872334a4fea47bf9963524657c0078d5fecf896bfdc26eefe67f55

# Cancel Order
npx ts-node src/script.ts --action close --escrowId 0xaa75d8bef4872334a4fea47bf9963524657c0078d5fecf896bfdc26eefe67f55