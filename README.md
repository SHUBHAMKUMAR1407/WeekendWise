# WeekendWise

A zero-login weekend trip planner for Indian travellers. A group link collects vibe votes and a comfort budget from each person. Solo travellers go straight to their shortlist. Each recommendation includes a forecast or seasonal fallback, an estimated crowd level, transport comparisons, a cost split, a Parent Pack and downloadable share cards.

## Live preview

[Open WeekendWise on Vercel](https://prompt-birch-o359hjo.tmp.now). This temporary deployment expires **26 November 2026 at 4:15 AM IST** unless claimed. This preview predates the MongoDB migration and must be redeployed with MongoDB configuration. The private ownership links and stats dashboard are in the ignored local file `.vercel/CLAIM.md`.

The public deployment passed room creation, joining, reveal, Parent Pack rendering, protected CSV and both PNG endpoints. A request using WhatsApp's crawler user agent found the image in the HTML head and fetched the advertised PNG from the public domain.

## Project folders

```text
WeekendWise/
??? frontend/
?   ??? src/
?   ?   ??? app/                 # Pages and Next.js route adapters
?   ?   ??? components/          # forms, home, layout, parents, trip
?   ?   ??? lib/                 # Browser API and analytics utilities
?   ?   ??? styles/              # Global styles
?   ??? public/                  # Images, icons and card fonts
?   ??? *.config.*               # Next.js, PostCSS and Tailwind configuration
??? backend/
?   ??? src/
?   ?   ??? routes/              # HTTP handlers
?   ?   ??? services/            # Trip planning, weather, transport and cards
?   ?   ??? db/                  # MongoDB storage and request quotas
?   ?   ??? analytics/           # First-party event aggregation
?   ?   ??? auth/                # Stats access checks
?   ?   ??? schemas/             # API input validation
?   ?   ??? types/               # Domain types and constants
?   ?   ??? utils/               # Date helpers
?   ?   ??? http/                # Request parsing and API errors
?   ?   ??? config/              # Public site configuration
?   ??? tests/                   # Vitest unit and regression tests
?   ??? data/                    # Destination and holiday seeds
??? package.json                # Shared install and run commands
??? tsconfig.json               # Shared strict TypeScript configuration
```

Use `@frontend/*` and `@backend/*` imports for application boundaries. Frontend route adapters export backend handlers so both parts run through the same Next.js server and public origin. Install dependencies and run commands from the repository root. Environment files in `backend/` supply server configuration. Vercel uses the repository root with build command `npm run build` and output directory `frontend/.next`.

VS Code hides generated build folders, installed dependencies and TypeScript caches through `.vscode/settings.json`. These folders remain available on disk.

## Run locally

Use Node.js 22 and npm. From this directory run:

```sh
npm ci
npm run dev
```

Open [the local planner](http://localhost:3000). Development runs without credentials using process-local memory. Restarting the dev server clears those rooms. To exercise persistent rooms, copy `backend/.env.example` to `backend/.env.local` and configure MongoDB. Production requires MongoDB and returns a friendly service error if storage is unavailable.

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Server-side MongoDB connection string (Atlas or local MongoDB) |
| `MONGODB_DB` | Database name; defaults to `weekendwise` |
| `GOOGLE_MAPS_API_KEY` | Server-side Google Maps Places API (New) key for live address autocomplete |
| `STATS_SECRET` | A long random secret for the funnel dashboard and CSV |
| `NEXT_PUBLIC_SITE_URL` | Public HTTPS origin used in WhatsApp and Twitter previews |

For a local MongoDB server, set `MONGODB_URI=mongodb://127.0.0.1:27017` and `MONGODB_DB=weekendwise` in `backend/.env.local`. For Atlas, use your cluster's Node.js connection string, create a database user with read/write access to this database, and allow the application server through Atlas network access. Restart the development server after changing environment variables. A value in `backend/.env.development.local` takes precedence over `backend/.env.local` during development.

The application reuses its MongoDB connection pool and creates `rooms`, `rate_limits`, and `analytics` collections with indexes automatically. Rooms expire 30 days after creation; reads and updates reject expired rooms immediately even before MongoDB's TTL cleanup runs. Request quotas use atomic sliding hourly windows. Analytics remains best effort and never blocks trip planning when unavailable. Configured MongoDB connection failures return errors rather than silently falling back to memory. Existing Redis data is not copied automatically; older room links require a separate data migration if they must be retained.

## Google Maps address suggestions

Enable **Places API (New)** in a Google Cloud project with billing enabled. Add its key as `GOOGLE_MAPS_API_KEY` in `backend/.env.development.local` (or `backend/.env.local`) and restart `npm run dev`. For a hosted deployment, add the same server-side variable and redeploy.

Restrict the key to Places API (New), and configure billing quotas for the project. Autocomplete requests are debounced by 350 ms, restricted to India and limited to 120 requests per hour per IP. This implementation uses per-request autocomplete billing. Search text is sent in a POST body and excluded from application analytics. Predictions use no-store responses and are held in the search interface.

Without the key, local suggestions remain available and the field reports that live search is unavailable. Google suggestions cover Indian places such as Sitamarhi. The travel dataset still supports the ten seeded departure cities, so selecting a location outside those origins shows a route-coverage message. Google search does not create transport estimates for additional cities.

The integration is verified with mocked provider responses, missing credentials, empty results and upstream errors. Live Google API verification is pending a configured key. [Google Places configuration and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

## Deploy on Vercel

1. Import this project into Vercel with the **Next.js** preset and repository root as the root directory. Use Node.js 22, `npm ci` and `npm run build`.
2. Add `MONGODB_URI`, `MONGODB_DB` and `STATS_SECRET` to the production environment. Set `NEXT_PUBLIC_SITE_URL` to the project's public domain. A Vercel deployment URL supplies a fallback when this value is absent.
3. Deploy from the dashboard or run `npx vercel deploy --prod` from an authenticated CLI. Redeploy after changing environment variables. The public trip and image endpoints must be accessible to logged-out preview crawlers.
4. Open `/?internal=1` on the builder’s device before testing. Visit `/stats?key=<your-secret>` privately to check the dashboard and export counts.

Keep credentials and private claim links outside the repository. A temporary, unclaimed service is suitable for synthetic demonstrations. Claim or replace temporary services before collecting real travellers' data. [Vercel environment configuration](https://vercel.com/docs/environment-variables) · [MongoDB connection setup](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/)

## Budget entry

Travellers type a positive whole-rupee budget manually on the landing and join forms. Creation and voting accept any positive safe integer, including amounts below ₹2,000, above ₹8,000 and amounts between ₹500 increments. Empty, zero, negative, fractional and unsafe numeric inputs are rejected.

## How the planner works

- **Rooms** use 10-character IDs and a fixed 30-day MongoDB expiry. Atomic vote updates keep the existing expiry, deduplicate by a room-specific ID and enforce the 20-person cap. The shared reveal flag and four-second SWR polling keep the results usable for late joiners.
- **Vibes** accept one to ten selections, including custom text up to 40 characters per choice. Custom choices appear in the group meter and match destination descriptions through deterministic keywords.
- **Recommendations** rank reachable destinations using votes, the cheapest participant’s budget, weather and estimated crowd. The second pick differs in region or vibe. Edits invalidate the shortlist through its vote-dependent cache key.
- **Transport** ranks available modes by usable arrival time, total transport cost, pickup conditions, forecast sensitivity and overnight travel. Cost includes both last-mile transfers. Selecting another route updates costs and carries the selection into the brief and card.
- **Weather** comes from Open-Meteo with three-hour caching, a 3.5-second request deadline and full date-coverage validation. Unavailable forecasts fall back to seasonal notes. The crowd estimate combines the calendar month, weekend travel and local holiday windows.
- **Parent Pack** has 12 English template combinations. The screen provides a WhatsApp message, call pitch, six checklist items and a printable one-page PNG. Family and reception contact blanks can be filled privately. All brief and share images are rendered by `next/og`.
- **Analytics** uses first-party events and distinct anonymous browser IDs. Server-side creation and vote events are recorded after successful writes. A vote edit counts once per voter and room within the reporting period. Ordered funnel stages are visit → create or vote → reveal → Parent Pack. The denominator for average voters is group rooms created during the period, including empty rooms. The dashboard ranks destinations by first-pick trip checks and counts referrers from page views. A completed file share and a PNG download are different actions. Only successful Web Share calls increment cards shared.
- **Privacy** uses anonymous device hashes for aggregate counters. Room names and choices expire after 30 days. Raw IP addresses, personal contact numbers, message content and location shares are excluded from analytics. `internal=1` persists on the device. Link-preview crawlers are excluded by user agent.

## Tests and QA

```sh
npm test
npm run typecheck
npm run build
npm start
```

MongoDB regression tests use a disposable local server and require an explicit opt-in. In PowerShell run `$env:MONGODB_INTEGRATION='1'; $env:MONGOMS_DOWNLOAD_DIR="$PWD/.cache/mongodb"; npm test -- backend/tests/mongodb.test.ts`. The first run downloads the MongoDB server binary; subsequent runs reuse it. The test database is temporary and does not use your configured Atlas database.

| Check | Result in this session |
| --- | --- |
| Core and regression tests | 37 passed across recommendation, weather, crowd, Smart Swap, cost split, transport, Parent Pack, resistance, dates, analytics, room expiry and quotas. |
| Group flow | Two separate 375 px Chromium browser contexts created and joined a room. The first browser displayed the other vote in 2.4 seconds. Both saw the shared reveal. |
| Solo and transport flow | Solo went straight to recommendations. Selecting another route changed the displayed estimate from ₹5,095 to ₹5,670 and carried that route into the Parent Pack. |
| MongoDB storage | Five tests passed against a disposable real MongoDB server: concurrent voting and edits, capacity, unchanged expiry, expired/solo rejection, sliding quotas, persisted analytics and production configuration. Atlas/deployment verification is pending a configured connection string. |
| Real weather and failure handling | Open-Meteo returned forecasts for both picks in a production smoke test. Unit tests cover request failure, incomplete forecasts and dates outside the forecast window. |
| Share previews | A WhatsApp crawler request received OG image tags in the initial HTML head. Trip and Parent Brief endpoints returned 1080×1350 PNGs. Both images were visually inspected. |
| Mobile browser fallbacks | File download, denied clipboard fallback, English output, six checklist items and the expired-room footer passed in Chromium mobile emulation. A second run using WebKit with an iPhone viewport passed solo reveal, PNG download, Parent Pack generation and clipboard fallback. Both engines emitted zero browser JavaScript errors. |
| Footer / analytics | Shared layout covers home, trip, parents, stats, loading, expired and route errors. Root crash fallback renders the same footer constant. Unit tests exclude crawler and internal visits. Protected CSV accepted the correct secret and rejected a wrong one. |
| Lighthouse | Local production landing page in mobile simulation scored **95 performance / 100 accessibility**. LCP 2.8 s, total blocking time 80 ms, CLS 0. First-load JS reported by Next.js was 108 kB for the landing page. |
| Physical devices | Two physical phones, native WhatsApp preview caching, actual iOS Safari and Android Chrome downloads, and the Instagram/WhatsApp in-app browsers require device verification. Chromium and WebKit emulation cover the browser flows only. |

## Community crowd signals

The trip reveal and `/updates` include five IST calendar days of crowd history, including today. `GET /api/crowd/[destinationId]?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` returns daily aggregates and the number of explicit trip-interest records overlapping those dates. `POST` accepts either `kind: "checkin"` or `kind: "interest"`. Check-ins require explicit consent, a fresh browser position with accuracy within 2 km, and proximity within 25 km of the destination's listed coordinates. Location is requested only after a user submits the consent form. The server discards coordinates, accuracy, device timestamp and raw browser identifiers after validation; crowd counting does not save raw IPs. Browser location can be spoofed, so this is a proximity check, not verified attendance. Existing hashed-IP rate limits apply to submissions.

MongoDB `crowd_signals` stores one check-in per browser/destination/IST day and one editable planning-interest record per browser/destination, expiring after 30 days. Reports in `traveller_updates` and check-ins share a hashed deduplication key. Aggregation uses all reports in the five-day window, rather than the latest 20 displayed visitor updates, and takes the newest crowd observation for each browser/day. Checking in and submitting a report cannot create two crowd samples for the same browser/day. Public responses contain aggregates only. Planning interest is explicitly submitted, can be removed, and is never inferred from viewing a recommendation.

Observed levels average quiet=1, moderate=2, busy=4, packed=5. Fewer than three samples shows “Not enough reports”; 3–9 samples is labelled limited evidence and 10+ moderate evidence. These are sample-size labels, not statistical confidence or verified headcounts. Empty days are never treated as quiet or filled with synthetic history. Rising/falling compares today and yesterday only when both have at least three samples, using a 0.5-point change threshold. Today is partial. Seasonal/weekend/holiday estimates for future trip dates stay separate from observed history and planning-interest counts; community signals do not change recommendation rankings. Data collection starts with real submissions after deployment. No historical crowd readings are fabricated.

Run `npm test -- backend/tests/crowd.test.ts` for date boundaries, validation, deduplication, retention and API privacy checks. Set `MONGODB_INTEGRATION=1` to include the real disposable MongoDB aggregation test in `backend/tests/mongodb.test.ts`.

## Data maintenance

[Verification checklist](backend/data/VERIFY.md) covers every destination, transport and holiday field requiring review. The seed includes **27 destinations, 42 origin–destination pairs, 85 gateways and 112 transport options** across ten starting cities. Keep `hasGoSTOPS` false until you verify an operating property. Review holiday dates, timings, fare ranges, last-mile estimates and night pickup before marking a record verified.

Set `WEATHER_API_KEY` in `backend/.env.development.local` (or `backend/.env.local`) and restart the development server to use [WeatherAPI](https://www.weatherapi.com/docs/forecast-api/). For hosted deployments, configure the same server-side variable and redeploy. Requests use destination coordinates and require coverage of every trip date; unavailable forecasts or plan limits fall back to [Open-Meteo](https://open-meteo.com/), then seasonal guidance. Keep the key server-side. Seasonal, cost and transport estimates are maintained in this repository.

[Implementation assumptions](ASSUMPTIONS.md) · [Photography credits](frontend/public/images/CREDITS.md)
