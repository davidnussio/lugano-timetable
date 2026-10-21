This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Usual journeys (push notifications)

In the journey planner a journey can be saved as a usual journey
("tragitto abituale"): on the chosen days the app sends a push notification
about 20 minutes before it is time to leave home, an update when a delay
moves the leave time by 2 minutes or more (or a transfer is lost), and
"Esci ora" at the leave time, also with the app closed. The server writes
them in the language of the app (`routineAlerts` in `src/i18n/messages`),
sent with the journeys whenever the journey page syncs them; journeys saved
before without a language get Italian. The feature stays hidden until it is
configured.

1. Redis: the same Upstash database as the RTPI sessions
   (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` of the Vercel Marketplace).
2. VAPID keys, generated once with `npx web-push generate-vapid-keys`:

   ```bash
   VAPID_PUBLIC_KEY=<public key>
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the same public key>
   VAPID_PRIVATE_KEY=<private key>
   VAPID_SUBJECT=mailto:you@example.com
   ```

   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is read at build time: redeploy after
   setting it. Changing the keys later makes the browsers subscribe again
   the next time the app is opened.
3. `CRON_SECRET`: a long random string (`openssl rand -hex 32`).
4. A scheduler calling `/api/routines/tick` every minute with the header
   `Authorization: Bearer <CRON_SECRET>` (GET or POST). Vercel Cron is not
   used: the Hobby plan only allows daily jobs. For example an
   [Upstash QStash](https://upstash.com/docs/qstash) schedule with cron
   `* * * * *`, destination `https://<your app>/api/routines/tick` and the
   header `Authorization: Bearer <CRON_SECRET>` (through the QStash API it
   is passed as `Upstash-Forward-Authorization`), or a job on
   [cron-job.org](https://cron-job.org) with the same header.

Without Redis or the VAPID keys `/api/routines` answers 503 and the app
hides the feature; without `CRON_SECRET` the tick answers 503. On iPhone,
push notifications need the app added to the home screen (iOS 16.4+).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
