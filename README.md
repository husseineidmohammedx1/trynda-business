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

1. Create a PostgreSQL database in Render.
2. Create a Web Service from the GitHub repository.
3. Use these settings:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Environment: `Node`
4. Add these environment variables to the Web Service:
   - `DATABASE_URL`: the internal database URL from the Render PostgreSQL service
   - `AUTH_SECRET`: a long random value, different from local development
   - `GMAIL_USER`: the Gmail address used to send reset emails
   - `GMAIL_APP_PASSWORD`: a Gmail App Password, not the normal Gmail password
5. After the first deploy, open the Web Service Shell and run:

   ```bash
   npx prisma db push
   npx tsx create-admin.ts
   ```

   Use a new admin password before production. The database must be available before running these commands.

Do not commit `.env`, `.env.local`, `.next`, or real credentials. Set secrets in Render Environment Variables instead.
