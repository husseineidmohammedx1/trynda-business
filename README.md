# Trynda Bussines

Initial Next.js + Prisma + PostgreSQL MVP.

## Run locally
1. Install Node.js 20+.
2. Create `.env`:
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
3. `npm install`
4. `npx prisma generate`
5. `npx prisma db push`
6. `npm run dev`

## Render
Create a PostgreSQL database, set `DATABASE_URL`, build with `npm install && npx prisma generate && npm run build`, start with `npm start`.

Authentication/API routes are the next implementation step; the current UI is intentionally a clean foundation.
