import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { destroyDatabase } from "@/lib/db/sqlite";

vi.mock("next/font/google", () => ({
  Geist: () => ({
    variable: "font-geist-sans",
  }),
  Geist_Mono: () => ({
    variable: "font-geist-mono",
  }),
}));

type LockMode = "exclusive" | "shared";

type HeldLock = {
  mode: LockMode;
  name: string;
};

const heldLocks = new Map<string, HeldLock>();

Object.defineProperty(globalThis.navigator, "locks", {
  configurable: true,
  value: {
    async query() {
      return {
        held: Array.from(heldLocks.values()),
        pending: [],
      };
    },
    async request(
      name: string,
      options:
        | { ifAvailable?: boolean; mode?: LockMode; signal?: AbortSignal }
        | ((lock: HeldLock | null) => Promise<unknown> | unknown),
      maybeCallback?: (lock: HeldLock | null) => Promise<unknown> | unknown,
    ) {
      const callback =
        typeof options === "function" ? options : maybeCallback ?? (() => null);
      const lockOptions =
        typeof options === "function" ? {} : (options ?? {});
      const mode = lockOptions.mode ?? "exclusive";

      if (lockOptions.ifAvailable && heldLocks.has(name)) {
        return callback(null);
      }

      if (lockOptions.signal?.aborted) {
        throw new DOMException("", "AbortError");
      }

      const lock = { name, mode };
      heldLocks.set(name, lock);

      try {
        return await callback(lock);
      } finally {
        heldLocks.delete(name);
      }
    },
  },
});

afterEach(async () => {
  cleanup();
  heldLocks.clear();
  await destroyDatabase();
});
