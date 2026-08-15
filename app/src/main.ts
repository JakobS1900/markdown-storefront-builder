/**
 * Entry point.
 *
 * Opens the most recently edited page if there is one, otherwise starts a new
 * one. Storage failure is reported rather than hidden: a tool that appears to
 * save and does not is worse than one that admits it cannot.
 */
import { listPages, init, openPage, subscribe } from "./store.js";
import { storageAvailable } from "./db.js";
import { renderShell } from "./ui/shell.js";

async function start(): Promise<void> {
  const root = document.getElementById("app");
  if (root === null) throw new Error("missing #app");

  const storageOk = await storageAvailable();
  init(storageOk);

  subscribe(() => renderShell(root));
  renderShell(root);

  if (!storageOk) return;

  // Reopen the page they were last working on. openPage reports its own
  // failure, including handing back the raw file, so nothing is swallowed here.
  const pages = await listPages();
  const mostRecent = pages[0];
  if (mostRecent !== undefined) await openPage(mostRecent.id);
}

void start();
