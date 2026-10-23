import "server-only";
import { execute, type Db } from "./db";

export type AuditAction =
  | "activity.create"
  | "activity.update"
  | "activity.activate"
  | "activity.deactivate"
  | "activity.reorder"
  | "activity.delete"
  | "activity.soft_delete"
  | "user.role_change"
  | "user.activate"
  | "user.deactivate"
  | "week.reopen"
  | "export.csv"
  | "account.password_change";

type Details = Record<string, string | number | boolean | null>;

/** Appends one audit entry. Pass the transaction connection so it commits/rolls back with the change. */
export async function audit(
  db: Db,
  entry: { actorId: number; action: AuditAction; entity: string; entityId: number | null; details?: Details; ip: string | null },
): Promise<void> {
  await execute(
    "INSERT INTO audit_log (actor_id, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)",
    [entry.actorId, entry.action, entry.entity, entry.entityId, entry.details ? JSON.stringify(entry.details) : null, entry.ip],
    db,
  );
}
