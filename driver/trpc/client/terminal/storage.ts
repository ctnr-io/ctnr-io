import { join } from "node:path";
import * as fs from "@std/fs";

const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
const configDir = join(homeDir, ".ctnr");
const storageFile = join(configDir, "auth.json");

Deno.mkdirSync(configDir, { recursive: true });
if (!fs.exists(storageFile)) {
  // Initialize storage file if it doesn't exist
  Deno.writeTextFileSync(storageFile, JSON.stringify({}));
} else {
  // Ensure storage file is valid JSON
  try {
    const storageData = Deno.readTextFileSync(storageFile);
    JSON.parse(storageData);
  } catch (error) {
    if (error instanceof Error) {
      console.warn("Invalid auth storage file, resetting:", error.message);
    }
    Deno.writeTextFileSync(storageFile, JSON.stringify({}));
  }
}

export const authStorage = {
  getItem: (key: string) => {
    const storageData = Deno.readTextFileSync(storageFile);
    const storage = JSON.parse(storageData);
    return storage[key] || null;
  },
  setItem: (key: string, value: string) => {
    const storageData = Deno.readTextFileSync(storageFile);
    const storage = JSON.parse(storageData);
    storage[key] = value;
    Deno.writeTextFileSync(storageFile, JSON.stringify(storage, null, 2));
  },
  removeItem: (key: string) => {
    const storageData = Deno.readTextFileSync(storageFile);
    const storage = JSON.parse(storageData);
    delete storage[key];
    Deno.writeTextFileSync(storageFile, JSON.stringify(storage, null, 2));
  },
};
