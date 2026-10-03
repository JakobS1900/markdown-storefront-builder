/**
 * Opening a backup the artist saved earlier.
 *
 * The Copy screen has always offered "a backup you can reopen here" and there
 * was nowhere to reopen it: no file input on any surface, and nothing in the
 * app that read a file except the image picker. The roadmap listed import as
 * shipped. A backup that cannot be restored is not a backup, it is a file, and
 * this project's constitution calls losing someone's page the one unforgivable
 * failure.
 *
 * The rule here is the same one the rest of the storage layer follows: opening
 * a backup never destroys the page already open. It arrives as a new page with
 * its own id, so a file opened by mistake costs nothing, and a file that turns
 * out not to be a page changes nothing at all.
 */
import { parseDocument, serializeDocument, type Document } from "@mdsb/engine";

import { writePage } from "./db.js";
import { adopt, newId, pagePasteConfirmationActive, refreshPages } from "./store.js";

export interface Opened {
  readonly ok: boolean;
  /** Written for the artist, whether it worked or not. */
  readonly message: string;
}

let openingBackups = 0;
let backupWaiters: (() => void)[] = [];

export function backupOpening(): boolean {
  return openingBackups > 0;
}

export function waitForOpenBackups(): Promise<void> {
  return openingBackups === 0 ? Promise.resolve() : new Promise((resolve) => { backupWaiters.push(resolve); });
}

/**
 * Reads the text of a backup and opens it.
 *
 * Nothing is written until the content has parsed, so a refused file cannot
 * leave a half-written record behind.
 */
export async function openBackup(text: string, adoptOpenedPage: (pageId: string, doc: Document) => void = adopt): Promise<Opened> {
  const ordinaryOpen = adoptOpenedPage === adopt;
  if (ordinaryOpen) openingBackups += 1;
  try {
    return await openBackupWrite(text, adoptOpenedPage);
  } finally {
    if (ordinaryOpen) {
      openingBackups -= 1;
      if (openingBackups === 0) {
        const waiters = backupWaiters;
        backupWaiters = [];
        for (const resolve of waiters) resolve();
      }
    }
  }
}

async function openBackupWrite(text: string, adoptOpenedPage: (pageId: string, doc: Document) => void): Promise<Opened> {
  const result = parseDocument(text);

  if (!result.ok) {
    const version = result.issues.some((i) => i.message.toLowerCase().includes("version"));
    return {
      ok: false,
      message: version
        ? "That backup was saved by a newer version of this tool, so it has not been opened. Nothing has been changed."
        : "That file is not a saved page, so it has not been opened. Nothing has been changed.",
    };
  }

  if (adoptOpenedPage === adopt && pagePasteConfirmationActive()) {
    return { ok: false, message: "Finish adding the pasted page before opening another page. Nothing has been changed." };
  }

  const id = newId();
  await writePage({
    id,
    json: serializeDocument(result.document),
    title: result.document.title ?? "Untitled page",
    updatedAt: Date.now(),
  });

  adoptOpenedPage(id, result.document);
  // A page has just come into existence, so the switcher has to know about it,
  // and about the page it now sits beside.
  await refreshPages();
  // This sentence has been wrong twice. It first read "the page you had open is
  // still saved on this device", which was accurate and read as an offer: it
  // implied you could go back, and there was no way to. It then said so plainly,
  // which was honest and no use. Both are now obsolete, because "Your pages" on
  // the Build screen is the route it is pointing at.
  return {
    ok: true,
    message:
      "Opened the backup as a new page. The page you had open is still saved, under Your pages on the Build screen.",
  };
}
