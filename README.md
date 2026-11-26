# WeekendWise

A zero-login weekend trip planner for Indian travellers. A group link collects vibe votes and a comfort budget from each person. Solo travellers go straight to their shortlist. Each recommendation includes a forecast or seasonal fallback, an estimated crowd level, transport comparisons, a cost split, a Parent Pack and downloadable share cards.

## Live preview

[Open WeekendWise on Vercel](https://prompt-birch-o359hjo.tmp.now). This temporary deployment expires **26 November 2026 at 4:15 AM IST** unless claimed. Its QA Redis database expires on 28 November unless claimed separately. The private ownership links and stats dashboard are in the ignored local file `.vercel/CLAIM.md`.

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
?   ?   ??? db/                  # Redis storage and request quotas
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

Use `@frontend/*` and `@backend/*` imports for application boundaries. Frontend route adapters export backend handlers so both parts run through the same Next.js server and public origin. Install dependencies and run commands from the repository root. Root environment files supply server configuration. Vercel uses the repository root with build command `npm run build` and output directory `frontend/.next`.

VS Code hides generated build folders, installed dependencies and TypeScript caches through `.vscode/settings.json`. These folders remain available on disk.

## Run locally

Use Node.js 22 and npm. From this directory run:

```sh
npm ci
npm run dev
```

Open [the local planner](http://localhost:3000). Development runs without credentials using process-local memory. Restarting the dev server clears those rooms. To exercise persistent rooms, create `.env.local` from `.env.example` and configure Upstash. Production requires Redis and returns a friendly service error if storage is unavailable.

| Variable | Value |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | HTTPS endpoint from your Upstash Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Server-side read/write REST token |
| `GOOGLE_MAPS_API_KEY` | Server-side Google Maps Places API (New) key for live address autocomplete |
| `STATS_SECRET` | A long random secret for the funnel dashboard and CSV |
| `NEXT_PUBLIC_SITE_URL` | Public HTTPS origin used in WhatsApp and Twitter previews |

## Google Maps address suggestions

Enable **Places API (New)** in a Google Cloud project with billing enabled. Add its key as `GOOGLE_MAPS_API_KEY` in the root `.env.development.local` (or `.env.local`) and restart `npm run dev -- -p 3001`. For a hosted deployment, add the same server-side variable and redeploy.

Restrict the key to Places API (New), and configure billing quotas for the project. Autocomplete requests are debounced by 350 ms, restricted to India and limited to 120 requests per hour per IP. This implementation uses per-request autocomplete billing. Search text is sent in a POST body and excluded from application analytics. Predictions use no-store responses and are held in the search interface.

Without the key, local suggestions remain available and the field reports that live search is unavailable. Google suggestions cover Indian places such as Sitamarhi. The travel dataset still supports the ten seeded departure cities, so selecting a location outside those origins shows a route-coverage message. Google search does not create transport estimates for additional cities.

The integration is verified with mocked provider responses, missing credentials, empty results and upstream errors. Live Google API verification is pending a configured key. [Google Places configuration and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

## Deploy on Vercel

1. Import this project into Vercel with the **Next.js** preset and repository root as the root directory. Use Node.js 22, `npm ci` and `npm run build`.
2. Add both Upstash variables and `STATS_SECRET` to the production environment. Set `NEXT_PUBLIC_SITE_URL` to the project's public domain. A Vercel deployment URL supplies a fallback when this value is absent.
3. Deploy from the dashboard or run `npx vercel deploy --prod` from an authenticated CLI. Redeploy after changing environment variables. The public trip and image endpoints must be accessible to logged-out preview crawlers.
4. Open `/?internal=1` on the builder’s device before testing. Visit `/stats?key=<your-secret>` privately to check the dashboard and export counts.

Keep credentials and private claim links outside the repository. A temporary, unclaimed service is suitable for synthetic demonstrations. Claim or replace temporary services before collecting real travellers' data. [Vercel environment configuration](https://vercel.com/docs/environment-variables) · [Upstash setup](https://upstash.com/docs/redis/overall/getstarted)

## Budget entry

Travellers type a positive whole-rupee budget manually on the landing and join forms. Creation and voting accept any positive safe integer, including amounts below ₹2,000, above ₹8,000 and amounts between ₹500 increments. Empty, zero, negative, fractional and unsafe numeric inputs are rejected.

## How the planner works

- **Rooms** use 10-character IDs and a fixed 30-day Redis expiry. Atomic vote updates keep the existing expiry, deduplicate by a room-specific ID and enforce the 20-person cap. The shared reveal flag and four-second SWR polling keep the results usable for late joiners.
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

| Check | Result in this session |
| --- | --- |
| Core and regression tests | 37 passed across recommendation, weather, crowd, Smart Swap, cost split, transport, Parent Pack, resistance, dates, analytics, room expiry and quotas. |
| Group flow | Two separate 375 px Chromium browser contexts created and joined a room. The first browser displayed the other vote in 2.4 seconds. Both saw the shared reveal. |
| Solo and transport flow | Solo went straight to recommendations. Selecting another route changed the displayed estimate from ₹5,095 to ₹5,670 and carried that route into the Parent Pack. |
| Real Redis | The production server created a room against Upstash, processed concurrent duplicate votes as one member, and retained approximately 30 days of TTL after updates. The eleventh creation request returned a friendly HTTP 429. |
| Real weather and failure handling | Open-Meteo returned forecasts for both picks in a production smoke test. Unit tests cover request failure, incomplete forecasts and dates outside the forecast window. |
| Share previews | A WhatsApp crawler request received OG image tags in the initial HTML head. Trip and Parent Brief endpoints returned 1080×1350 PNGs. Both images were visually inspected. |
| Mobile browser fallbacks | File download, denied clipboard fallback, English output, six checklist items and the expired-room footer passed in Chromium mobile emulation. A second run using WebKit with an iPhone viewport passed solo reveal, PNG download, Parent Pack generation and clipboard fallback. Both engines emitted zero browser JavaScript errors. |
| Footer / analytics | Shared layout covers home, trip, parents, stats, loading, expired and route errors. Root crash fallback renders the same footer constant. Unit tests exclude crawler and internal visits. Protected CSV accepted the correct secret and rejected a wrong one. |
| Lighthouse | Local production landing page in mobile simulation scored **95 performance / 100 accessibility**. LCP 2.8 s, total blocking time 80 ms, CLS 0. First-load JS reported by Next.js was 108 kB for the landing page. |
| Physical devices | Two physical phones, native WhatsApp preview caching, actual iOS Safari and Android Chrome downloads, and the Instagram/WhatsApp in-app browsers require device verification. Chromium and WebKit emulation cover the browser flows only. |

## Data maintenance

[Verification checklist](backend/data/VERIFY.md) covers every destination, transport and holiday field requiring review. The seed includes **27 destinations, 42 origin–destination pairs, 85 gateways and 112 transport options** across ten starting cities. Keep `hasGoSTOPS` false until you verify an operating property. Review holiday dates, timings, fare ranges, last-mile estimates and night pickup before marking a record verified.

Forecast data is provided by [Open-Meteo](https://open-meteo.com/). Seasonal, cost and transport estimates are maintained in this repository.

[Implementation assumptions](ASSUMPTIONS.md) · [Photography credits](frontend/public/images/CREDITS.md)
