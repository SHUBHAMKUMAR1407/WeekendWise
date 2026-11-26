import { START_CITIES, type StartCity } from "@backend/types/index";

const aliases: Partial<Record<StartCity, string[]>> = {
  "Delhi NCR": ["delhi", "new delhi", "noida", "gurugram", "gurgaon", "ghaziabad", "faridabad"],
  Mumbai: ["bombay", "navi mumbai", "thane"],
  Bengaluru: ["bangalore"],
};

const areas = [
  "Sector 62, Noida", "Sector 18, Noida", "Saket, Delhi", "Rohini, Delhi",
  "Sector 29, Gurugram", "Andheri, Mumbai", "Bandra, Mumbai", "Thane, Mumbai",
  "Vashi, Navi Mumbai", "Baner, Pune", "Hinjewadi, Pune", "Kothrud, Pune",
  "Indiranagar, Bengaluru", "Koramangala, Bengaluru", "Whitefield, Bengaluru",
  "Secunderabad, Hyderabad", "Gachibowli, Hyderabad", "Madhapur, Hyderabad",
  "Sector 17, Chandigarh", "Sector 35, Chandigarh", "Salt Lake, Kolkata",
  "New Town, Kolkata", "Adyar, Chennai", "Velachery, Chennai",
  "Navrangpura, Ahmedabad", "Satellite, Ahmedabad", "Malviya Nagar, Jaipur",
  "Vaishali Nagar, Jaipur",
];

export function suggestOrigins(query: string): string[] {
  const search = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const choices = [...START_CITIES, ...areas, ...Object.values(aliases).flat()];
  return choices.filter(value => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(search))
    .sort((a, b) => Number(b.toLowerCase().startsWith(search)) - Number(a.toLowerCase().startsWith(search)))
    .slice(0, 6);
}

export function resolveOrigin(address: string): StartCity | null {
  const normalized = " " + address.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
  const matches = START_CITIES.filter(city =>
    [city.toLowerCase(), ...(aliases[city] ?? [])].some(name =>
      normalized.includes(" " + name + " "),
    ),
  );
  return matches.length === 1 ? matches[0] : null;
}
