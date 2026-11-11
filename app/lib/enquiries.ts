import { asc, eq, and } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import { enquiries, enquiryEvents, programs, type EnquiryStatus } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";
import { normalizePkMobile, type EnquiryInput } from "./enquiry.ts";
import { authorize, type StaffRecord } from "./permissions.ts";
import { isUuid, requestHash } from "./idempotency.ts";

type Submitted = { id: string; created: boolean };

const invalid = (fields: Record<string, string>) =>
  new DomainError("invalid_input", "Check the highlighted fields.", fields);

export async function getVisibleProgramTitles(db: Db): Promise<string[]> {
  const rows = await db
    .select({ title: programs.title })
    .from(programs)
    .where(eq(programs.visible, true))
    .orderBy(asc(programs.position));
  return rows.map((r) => r.title);
}

async function findExisting(db: Db, key: string, hash: string): Promise<Submitted | null> {
  const [row] = await db
    .select({ id: enquiries.id, requestHash: enquiries.requestHash })
    .from(enquiries)
    .where(eq(enquiries.idempotencyKey, key));
  if (!row) return null;
  if (row.requestHash !== hash) {
    throw new DomainError(
      "idempotency_conflict",
      "This enquiry was already sent with different details. Refresh and try again.",
    );
  }
  return { id: row.id, created: false };
}

export async function submitEnquiry(db: Db, input: EnquiryInput): Promise<Submitted> {
  if (typeof input.idempotencyKey !== "string" || !isUuid(input.idempotencyKey)) {
    throw invalid({ idempotencyKey: "Invalid request key." });
  }

  const name = String(input.name ?? "").trim();
  const phone = normalizePkMobile(String(input.phone ?? "").trim());
  const program = String(input.program ?? "").trim();
  const message = String(input.message ?? "").trim();

  const hash = requestHash({ name, phone, program, message });
  const existing = await findExisting(db, input.idempotencyKey, hash);
  if (existing) return existing;

  const fields: Record<string, string> = {};
  if (!name) fields.name = "Enter your name.";
  else if (name.length > 80) fields.name = "Keep your name under 80 characters.";
  if (!phone) fields.phone = "Enter a Pakistani mobile number, like 0321 4220245.";
  if (!program) fields.program = "Pick what you want to join.";
  if (message.length > 500) fields.message = "Keep your message under 500 characters.";
  if (Object.keys(fields).length) throw invalid(fields);

  const result = await db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: programs.id })
      .from(programs)
      .where(and(eq(programs.title, program), eq(programs.visible, true)))
      .for("share");
    if (!p) throw invalid({ program: "Pick what you want to join." });

    const [row] = await tx
      .insert(enquiries)
      .values({ idempotencyKey: input.idempotencyKey, requestHash: hash, name, phone: phone!, program, message })
      .onConflictDoNothing({ target: enquiries.idempotencyKey })
      .returning({ id: enquiries.id });
    if (!row) return null; // lost a race; caller re-reads outside the transaction

    await tx.insert(enquiryEvents).values({ enquiryId: row.id, fromStatus: null, toStatus: "new", staffUserId: null });
    return row;
  });

  if (result) return { id: result.id, created: true };
  const winner = await findExisting(db, input.idempotencyKey, hash);
  if (!winner) throw new DomainError("misconfigured", "Enquiry insert conflicted but no enquiry was found");
  return winner;
}

export const nextEnquiryStatuses: Record<EnquiryStatus, readonly EnquiryStatus[]> = {
  new: ["contacted", "joined", "not_interested"],
  contacted: ["joined", "not_interested"],
  joined: [],
  not_interested: [],
};

export type EnquiryStatusInput = { enquiryId: string; to: EnquiryStatus; note?: string };

export async function changeEnquiryStatus(db: Db, actor: StaffRecord, input: EnquiryStatusInput): Promise<void> {
  authorize(actor, "enquiries.manage");
  const { enquiryId, to, note } = input;
  const staffUserId = actor.userId;
  if (typeof enquiryId !== "string" || !isUuid(enquiryId)) throw new DomainError("not_found", "Enquiry not found.");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: enquiries.status })
      .from(enquiries)
      .where(eq(enquiries.id, enquiryId))
      .for("update");
    if (!row) throw new DomainError("not_found", "Enquiry not found.");
    const from = row.status;
    if (!nextEnquiryStatuses[from].includes(to)) {
      throw new DomainError("invalid_transition", `An enquiry can't move from ${from} to ${to}.`);
    }
    await tx.update(enquiries).set({ status: to }).where(eq(enquiries.id, enquiryId));
    await tx.insert(enquiryEvents).values({ enquiryId, fromStatus: from, toStatus: to, staffUserId, note: note ?? null });
  });
}

export function enquiryWhatsAppUrl(
  ownerWhatsApp: string,
  e: { name: string; phone: string; program: string; message: string },
): string {
  const lines = [`New enquiry from ${e.name}`, `Phone: ${e.phone}`, `Interested in: ${e.program}`];
  if (e.message) lines.push(`Message: ${e.message}`);
  return `https://wa.me/${ownerWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export async function setEnquiryNotes(
  db: Db,
  actor: StaffRecord,
  input: { enquiryId: string; notes: string },
): Promise<void> {
  authorize(actor, "enquiries.manage");
  if (typeof input.enquiryId !== "string" || !isUuid(input.enquiryId)) {
    throw new DomainError("not_found", "Enquiry not found.");
  }
  const notes = input.notes.trim();
  if (notes.length > 2000) {
    throw new DomainError("invalid_input", "Keep notes under 2000 characters.", { notes: "Keep notes under 2000 characters." });
  }
  const done = await db
    .update(enquiries)
    .set({ notes })
    .where(eq(enquiries.id, input.enquiryId))
    .returning({ id: enquiries.id });
  if (!done.length) throw new DomainError("not_found", "Enquiry not found.");
}
