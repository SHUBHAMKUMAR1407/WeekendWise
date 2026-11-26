# Seed data verification

The seed covers 27 destinations, 42 origin–destination pairs and 112 transport options from 10 cities. Every price is a per-person planning estimate in INR. Route windows are local time in Asia/Kolkata. The data supports a comparison before booking. Operators can change schedules, drop points and fares.

## Before updating a destination

| Fields | What to check |
| --- | --- |
| `id`, `name`, `state`, `lat`, `lon` | Use stable IDs. Check the name, state and Open-Meteo coordinate against the actual stay area. Wayanad uses Kalpetta and Coorg uses Madikeri. |
| `routes[city]`, `mode`, `available` | Confirm that service operates from the named origin on practical weekend dates in both directions. Check the exact bus class and local boarding point. Remove an implausible pair or set the option unavailable. A gateway in the dataset can exist even when its mode is unavailable from a given origin. |
| `gatewayId`, gateway `id`, `type`, `name`, `code` | Confirm the actual arrival stop, station or airport, its map search result and its official railway or IATA code. For an intercity cab, the named central bus stand serves as a possible meeting point. |
| `nearestRailhead`, `nearestAirport` | Check which terminal is physically nearest and which actually has usable passenger services. Preserve the distinction between a hill railway and a broad-gauge gateway. |
| `distanceKmToDest`, `lastMile.minutes`, `lastMile.options`, `lastMile.costINR`, `lastMile.note` | Check the road distance to the central stay area, seasonal access, trip length, pickup location, available modes and one-way per-person fare. The cost range spans the listed options. The app counts this transfer in both directions. |
| `lateNightSafe` | Confirm that staffed areas and onward transport actually operate from 23:00 to 05:00. All seed values are false pending local confirmation. Treat this as a transport-availability flag. Personal safety requires checking conditions for the actual trip. |
| `typicalDepartureWindow`, `typicalArrivalWindow`, `hoursOnVehicle`, `overnight` | Look up representative outbound services and their return counterparts. Check midnight rollover, day-of-week restrictions and time spent on the vehicle. Keep the last-mile duration separate. Confirm an overnight option genuinely saves a paid night. |
| `costRoundTripINR`, `bookingHint` | Sample a regular weekend and a peak weekend. Confirm taxes, baggage, tolls, seat class and both legs. Self-drive estimates assign the whole vehicle cost to one traveller. Check per-vehicle fares before allowing any split. |
| `changes`, `weatherSensitivity` | Count connecting services, including a transfer onto a substantial regional road leg. Ordinary in-town station access is the final mile. Verify the road or railhead used, fog exposure, forest restrictions and monsoon detours. |
| `costPerDay.stay`, `food`, `local` | Check budget accommodation per person per night and food/local travel per person per day. Local travel excludes the separately counted gateway transfer. Recheck summer and festival rates. |
| `vibes`, `weekendCities`, `crowdByMonth`, `crowdNotes`, `bestTime`, `monsoonRisk` | Verify destination character, local seasonality and weekend draw from each listed origin. January is the first of 12 crowd values. Rain-risk months run from 1 to 12. Seasonal values are editorial estimates. |
| `localTips`, `itineraryTemplate` | Verify closures, trails, permits, temple hours, pickups and realistic travel time between stops. Weather or local instructions can change access. |
| `hasGoSTOPS` | Default false. Only enable after confirming a current operating goSTOPS property in the intended city on the operator’s site. The nightly estimate comes from the generic stay budget. |
| `confidence`, `lastVerified` | Keep `confidence` as `estimated`. Replace null with an ISO calendar date after reviewing the destination, all origin routes and gateway fields. |

## Calendar maintenance

`holidays.json` covers the six months beginning 26 November 2026. `startDate` and `endDate` are inclusive travel-pressure estimates. They can include adjacent weekend days. Entries with `states` apply to destinations in those states. Recent state notifications, weather, local events and school calendars can change the likely crowd. Each record carries a `verification` TODO.

Check gazetted festival dates locally, confirm moon-sighting holidays near the date, and replace the broad May school-break estimate with regional school calendars. Review this file monthly and extend it beyond 26 May 2027. [IIRS holiday calendar](https://www.iirs.gov.in/holidaycalender/) · [Government holiday calendar by state](https://www.india.gov.in/calendar?date=2027) · [Government astronomical festival calendar](https://packolkata.imd.gov.in/panchang/en/festivals)

## Sources for checking gateway geography

These sources establish selected access points. Recheck timetables and current prices separately.

- The Dehradun district pages identify Dehradun as the rail gateway for Mussoorie and Jolly Grant as the nearby airport for Rishikesh. [Mussoorie](https://dehradun.nic.in/tourist-place/mussoorie/) · [Rishikesh](https://dehradun.nic.in/tourist-place/dehradun/)
- Darjeeling district lists New Jalpaiguri, Siliguri and Bagdogra as hill-road gateways. [Darjeeling access](https://darjeeling.gov.in/how-to-reach/)
- Karnataka Tourism identifies Hosapete for Hampi and Gokarna Road for Gokarna. Konkan Railway lists the Bengaluru–Karwar service via Gokarna Road. [Hampi](https://karnatakatourism.org/en/destinations/hampi/) · [Gokarna](https://karnatakatourism.org/en/destinations/gokarna/) · [Konkan Railway service notice](https://konkanrailway.com/en/node/4289)
- The Satara district page lists Satara and Pune as rail gateways to Mahabaleshwar. Rajasthan Tourism identifies the rail connection through Ajmer for Pushkar and the downhill rail transfer for Mount Abu. [Mahabaleshwar](https://www.satara.gov.in/en/tourist-place/mahabaleshwar/) · [Pushkar](https://www.tourism.rajasthan.gov.in/pushkar.html) · [Mount Abu](https://www.tourism.rajasthan.gov.in/mount-abu.html)
- Puducherry district lists the city's rail, road and air access. Incredible India identifies Chengalpattu as the railhead for Mamallapuram. [Puducherry](https://puducherry-dt.gov.in/tourism/how-to-reach/) · [Mamallapuram](https://www.incredibleindia.gov.in/en/tamil-nadu/mamallapuram/mahabalipuram-beach)
- District tourism sources describe connections from Kolkata to Digha and Bolpur, and Warangal's rail access from Hyderabad. [Digha](https://purbamedinipur.gov.in/tourist-place/digha/) · [Bolpur](https://birbhum.gov.in/tourist-place/bolpur/) · [Warangal](https://warangal.telangana.gov.in/how-to-reach/)
