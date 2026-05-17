# FutureEd LMS — Deployment Guide

## Architecture Decision: Vercel + DigitalOcean

For your team size (2 admin · 5 sub-admin · 10 employees = **17 users**) the correct split is:

| Layer | Platform | Cost | Why |
|-------|----------|------|-----|
| **Frontend** (Next.js) | Vercel | **Free** (Hobby) | Zero config, auto SSL, global CDN, instant deploys |
| **Backend** (Fastify API) | DigitalOcean App Platform | **$5/mo** (Basic) | Fastify needs a persistent process; BullMQ workers and the follow-up cron job cannot run on serverless |
| **Database** (PostgreSQL) | Supabase | **Free** | Already connected, 500 MB storage is plenty for 17 users |
| **Redis** (Cache + Queue) | Upstash Redis | **Free** (10k req/day) | BullMQ requires `maxRetriesPerRequest: null` — Upstash supports this on their free tier |
| **File Storage** | Cloudflare R2 | **Free** (10 GB/mo) | No egress fees; S3-compatible API already coded |
| **Email** | Gmail SMTP | **Free** | App Password setup, 500 emails/day cap |

**Total monthly cost: ~$5/month**

> **Why not all-Vercel?** The Fastify backend runs BullMQ notification workers and a 30-minute follow-up cron job — these require a long-lived process. Vercel serverless functions time out at 10–60 seconds and have no persistent state. DigitalOcean App Platform gives you a real Node.js process for $5/mo.

---

## Part 1 — Before You Deploy (One-Time Setup)

### 1.1 Get Your Credentials

You need to collect these before doing anything:

#### Gmail SMTP (Email)
1. Go to your Google Account → **Security** → **2-Step Verification** (must be ON)
2. Go to **Security** → **App Passwords**
3. Select App: **Mail**, Device: **Other** → name it "FutureEd LMS"
4. Copy the 16-character password — you will never see it again

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourname@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx      ← the 16-char app password (spaces are fine, or remove them)
SMTP_FROM=FutureEd LMS <yourname@gmail.com>
```

#### Cloudflare R2 (File Upload)
1. Log in at **dash.cloudflare.com**
2. Left sidebar → **R2 Object Storage** → **Create Bucket**
   - Bucket name: `futureed-docs` (or any name, no spaces)
   - Region: Auto (leave default)
3. After creating: click the bucket → **Settings** tab → copy the **S3 API Endpoint** and **Account ID**
4. Back on R2 overview → **Manage R2 API tokens** → **Create API Token**
   - Permissions: **Object Read & Write** on your specific bucket
   - Copy the **Access Key ID** and **Secret Access Key** (shown only once)
5. **Enable Public Access** (so uploaded files can be viewed):
   - Bucket → **Settings** → **Public Access** → enable → copy the public URL
   - Format: `https://pub-xxxxxxxx.r2.dev`

```
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=futureed-docs
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

#### Upstash Redis (Queue + Cache)
1. Go to **console.upstash.com** → Create account → **Create Database**
   - Name: `futureed-redis`
   - Region: `ap-south-1` (closest to India)
   - Type: **Regional** (free)
2. After creation → **Details** tab → copy the **Redis URL**
   - Format: `rediss://default:PASSWORD@ENDPOINT.upstash.io:PORT`

```
REDIS_URL=rediss://default:xxxxxxxx@sharp-xxx-12345.upstash.io:6379
```

> **Note:** Upstash uses TLS (`rediss://`). Your existing ioredis config supports this.

#### Generate a Secure JWT Secret
Run this in any terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output — this is your `JWT_SECRET`.

---

## Part 2 — Database Setup (Supabase)

You already have Supabase connected. Before deploying, run migrations on the production database:

```bash
# From project root
cd packages/db
DATABASE_URL="your-supabase-url" npx prisma migrate deploy
```

Or set `DATABASE_URL` in your shell and run:
```bash
pnpm --filter @lms/db db:migrate
```

To seed initial admin user (if starting fresh):
```bash
DATABASE_URL="your-supabase-url" npx ts-node prisma/seed.ts
```

---

## Part 3 — Deploy the Backend on DigitalOcean App Platform

### 3.1 Push Your Code to GitHub First

Make sure your monorepo is pushed to a GitHub repository (public or private).

### 3.2 Create the App

1. Go to **cloud.digitalocean.com** → **Apps** → **Create App**
2. Select **GitHub** → authorize and select your repo
3. Choose the **main** branch
4. DigitalOcean will auto-detect the monorepo. If it does not, continue to Step 3.3.

### 3.3 Configure the Service

On the "Configure your app" screen, click **Edit** on the detected service (or **Add Service** → **Web Service**):

| Setting | Value |
|---------|-------|
| **Name** | `futureed-api` |
| **Source Directory** | `apps/api` |
| **Build Command** | `cd ../.. && npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @lms/db db:generate && pnpm --filter api build` |
| **Run Command** | `node dist/app.js` |
| **HTTP Port** | `5000` |
| **Plan** | Basic — $5/mo (512 MB RAM, 1 vCPU) |

> The build command installs pnpm, installs all workspace deps, generates the Prisma client, then builds the API TypeScript.

### 3.4 Add All Environment Variables

Click **Edit → Environment Variables** and add these (all as **Encrypted**):

```
NODE_ENV=production
PORT=5000
DATABASE_URL=<your-supabase-connection-string>
REDIS_URL=<your-upstash-redis-url>
JWT_SECRET=<your-64-char-hex-secret>
CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
API_BASE_URL=https://your-api-slug.ondigitalocean.app/api/v1

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourname@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=FutureEd LMS <yourname@gmail.com>

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=futureed-docs
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

> Set `CORS_ORIGIN` and `FRONTEND_URL` to the Vercel URL **after** you deploy the frontend (Step 4). You can update them later.

### 3.5 Deploy

Click **Create Resources** → wait 3–5 minutes for the build.

Once deployed, your API will be at:
```
https://futureed-api-xxxxx.ondigitalocean.app
```

Test it:
```
https://futureed-api-xxxxx.ondigitalocean.app/health
```
Expected response: `{"status":"ok"}`

### 3.6 Run Database Migrations on First Deploy

In the App Platform dashboard → **Console** tab (or use **Run Command**):
```bash
cd packages/db && npx prisma migrate deploy
```

---

## Part 4 — Deploy the Frontend on Vercel

### 4.1 Import the Project

1. Go to **vercel.com** → **Add New Project**
2. Import from GitHub → select your repo
3. Vercel detects it as a monorepo

### 4.2 Configure

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/web` |
| **Build Command** | (leave default: `next build`) |
| **Output Directory** | (leave default: `.next`) |
| **Install Command** | `cd ../.. && npm install -g pnpm && pnpm install --frozen-lockfile` |

> Vercel runs the install from the root, then builds `apps/web`. This ensures shared packages (`@lms/types`, etc.) are available.

### 4.3 Add Environment Variable

Under **Environment Variables**:

```
NEXT_PUBLIC_API_URL=https://futureed-api-xxxxx.ondigitalocean.app
```

> This is the only frontend env var. It must start with `NEXT_PUBLIC_` to be exposed in the browser.

### 4.4 Deploy

Click **Deploy** → wait 2–3 minutes.

Your frontend will be live at:
```
https://futureed-lms.vercel.app   (or your custom domain)
```

### 4.5 Update Backend CORS

Go back to DigitalOcean App Platform → your app → **Settings** → **Environment Variables** → update:

```
CORS_ORIGIN=https://futureed-lms.vercel.app
FRONTEND_URL=https://futureed-lms.vercel.app
```

Click **Save** → the backend auto-redeploys.

---

## Part 5 — Custom Domain (Optional but Recommended)

### Frontend (Vercel)
1. Vercel dashboard → your project → **Settings** → **Domains**
2. Add `lms.futureeducation.in` (or whatever your domain is)
3. Vercel gives you DNS records — add them in your domain registrar

### Backend (DigitalOcean)
1. App Platform → your app → **Settings** → **Domains**
2. Add `api.futureeducation.in`
3. Add the CNAME record in your domain registrar

After custom domains are live, update env vars:
```
# Backend
CORS_ORIGIN=https://lms.futureeducation.in
FRONTEND_URL=https://lms.futureeducation.in
API_BASE_URL=https://api.futureeducation.in/api/v1

# Frontend (Vercel)
NEXT_PUBLIC_API_URL=https://api.futureeducation.in
```

---

## Part 6 — Verify Everything Works

### 6.1 Health Check
```
GET https://api.futureeducation.in/health
→ { "status": "ok" }
```

### 6.2 Email Test
Log in as admin → create a new employee account → check if the welcome/setup email arrives in their inbox.

If it does not arrive:
- Check spam folder
- Check DigitalOcean logs: App Platform → **Runtime Logs**
- Look for: `✓ Email service connected` on startup
- Look for: `⚠ Email not configured` (means SMTP_USER or SMTP_PASS is missing/wrong)

### 6.3 File Upload Test
Log in as employee → open any lead → try uploading a document (marksheet, ID proof, etc.)

The file should upload and the URL returned should start with `https://pub-xxx.r2.dev/...` (your Cloudflare R2 public URL), not `localhost`.

If it falls back to localhost storage, check R2 env vars are set correctly in DigitalOcean.

### 6.4 Redis / Queue Test
After creating an employee and assigning a lead to them, check:
- Employee receives a "Lead assigned" email → BullMQ queue is working
- Dashboard activity feed updates in ~30 seconds → Redis cache is working

---

## Part 7 — Ongoing Operations

### Re-Deploying After Code Changes

**Frontend:** Push to the `main` branch → Vercel auto-deploys (no action needed).

**Backend:** Push to the `main` branch → DigitalOcean App Platform auto-deploys.

### Running Database Migrations After Schema Changes

After pushing a new Prisma migration, connect to the DigitalOcean console and run:
```bash
cd packages/db && npx prisma migrate deploy
```

Or add it to the build command:
```bash
... && npx prisma migrate deploy && node dist/app.js
```

### Viewing Logs

- **Backend logs:** DigitalOcean App Platform → your app → **Runtime Logs**
- **Frontend logs:** Vercel → your project → **Deployments** → click a deployment → **Functions** tab

### Scaling (If Needed in Future)

For 17 users the Basic plan ($5/mo, 512MB RAM) is more than sufficient. If you ever onboard more branches:
- Scale backend: bump to Professional plan ($12/mo, 1 GB RAM)
- Database: upgrade Supabase to Pro ($25/mo) for more connections and storage
- Redis: upgrade Upstash if you exceed 10k requests/day

---

## Full Environment Variable Reference

### Backend (`apps/api/.env` or DigitalOcean env vars)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | Yes | `production` | Must be `production` for R2 to activate |
| `PORT` | No | `5000` | DigitalOcean auto-sets this |
| `DATABASE_URL` | Yes | `postgresql://...` | Supabase connection string |
| `REDIS_URL` | Yes | `rediss://...` | Upstash URL with TLS |
| `JWT_SECRET` | Yes | 64-char hex string | Generated with `crypto.randomBytes(64)` |
| `CORS_ORIGIN` | Yes | `https://yourapp.vercel.app` | Frontend URL, no trailing slash |
| `FRONTEND_URL` | Yes | `https://yourapp.vercel.app` | Used in email links |
| `API_BASE_URL` | No | `https://yourapi.ondigitalocean.app/api/v1` | Used internally |
| `SMTP_HOST` | No | `smtp.gmail.com` | Default is Gmail |
| `SMTP_PORT` | No | `587` | 587 for TLS, 465 for SSL |
| `SMTP_USER` | Yes* | `you@gmail.com` | *Emails won't send without this |
| `SMTP_PASS` | Yes* | `xxxx xxxx xxxx xxxx` | Gmail App Password |
| `SMTP_FROM` | No | `FutureEd LMS <you@gmail.com>` | Sender name shown in emails |
| `R2_ACCOUNT_ID` | Yes* | `abc123def456` | *Falls back to local disk without this |
| `R2_ACCESS_KEY_ID` | Yes* | `your-key-id` | Cloudflare R2 API token |
| `R2_SECRET_ACCESS_KEY` | Yes* | `your-secret` | Cloudflare R2 API secret |
| `R2_BUCKET_NAME` | Yes* | `futureed-docs` | Your R2 bucket name |
| `R2_PUBLIC_URL` | Yes* | `https://pub-xxx.r2.dev` | R2 public access URL |

### Frontend (`apps/web/.env.local` or Vercel env vars)

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://yourapi.ondigitalocean.app` |

---

## Quick Start Checklist

- [ ] Gmail App Password generated and tested
- [ ] Cloudflare R2 bucket created with public access enabled
- [ ] R2 API token created (read + write on your bucket)
- [ ] Upstash Redis database created (region: ap-south-1)
- [ ] JWT secret generated (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- [ ] Code pushed to GitHub
- [ ] DigitalOcean App Platform app created with all env vars
- [ ] Backend health check returns `{"status":"ok"}`
- [ ] Vercel project created with `NEXT_PUBLIC_API_URL` pointing to DigitalOcean
- [ ] Backend `CORS_ORIGIN` updated to Vercel URL
- [ ] Database migrations run on production
- [ ] Login works end-to-end
- [ ] Email delivery tested (create employee, check inbox)
- [ ] File upload tested (upload a document on any lead)
