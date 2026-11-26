import {
  MongoError,
  MongoParseError,
  MongoServerSelectionError,
} from "mongodb";

export class StorageError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "StorageError";
  }
}

// Never return or log MongoDB error messages: they can contain connection details.
export function storageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  // The driver can load through both CJS and ESM entry points in a bundled app.
  const name = error instanceof Error ? error.name : "";
  const mongo = error instanceof MongoError || name.startsWith("Mongo");
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (error instanceof MongoParseError || name === "MongoParseError")
    return new StorageError("STORAGE_CONFIG", "Trip storage configuration is invalid. Please contact the site owner.");
  if (mongo && code === 18)
    return new StorageError("STORAGE_AUTH", "Trip storage authentication failed. Please contact the site owner.");
  if (mongo && code === 13)
    return new StorageError("STORAGE_PERMISSION", "Trip storage permissions are missing. Please contact the site owner.");
  if (error instanceof MongoServerSelectionError || name === "MongoServerSelectionError")
    return new StorageError("STORAGE_UNREACHABLE", "Trip storage cannot be reached. Please try again shortly.");
  return new StorageError("STORAGE_UNAVAILABLE", "Trip storage is unavailable. Please try again shortly.");
}
