import { afterEach } from "vitest";

import { resetStoreForTests } from "../src/store.js";

afterEach(() => {
  resetStoreForTests();
});
