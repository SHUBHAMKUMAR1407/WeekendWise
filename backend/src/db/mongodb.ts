import { MongoClient, type Db } from "mongodb";

const shared = globalThis as typeof globalThis & {
  weekendwiseMongo?: Promise<Db>;
};

export const hasMongo = () => Boolean(process.env.MONGODB_URI?.trim());

// Reuse the connection pool across requests and development hot reloads.
export function database(): Promise<Db> {
  if (!hasMongo()) throw new Error("MONGODB_URI is not configured.");
  if (!shared.weekendwiseMongo) {
    const client = new MongoClient(process.env.MONGODB_URI!, {
      maxPoolSize: 10,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 5000,
      waitQueueTimeoutMS: 5000,
    });
    shared.weekendwiseMongo = (async () => {
      try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB || "weekendwise");
        await Promise.all([
          db.collection("rooms").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
          db.collection("rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
          db.collection("analytics").createIndex({ scope: 1, "sets.groups": 1 }),
          db.collection("traveller_updates").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
          db.collection("traveller_updates").createIndex({ "report.destinationId": 1, "report.visitedOn": -1, "report.updatedAt": -1, _id: 1 }),
        ]);
        return db;
      } catch (error) {
        await client.close();
        shared.weekendwiseMongo = undefined;
        throw error;
      }
    })();
  }
  return shared.weekendwiseMongo;
}
