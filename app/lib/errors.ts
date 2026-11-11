export type DomainErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "shop_closed"
  | "unavailable"
  | "insufficient_stock"
  | "invalid_transition"
  | "idempotency_conflict"
  | "misconfigured";

export class DomainError extends Error {
  code: DomainErrorCode;
  fields?: Record<string, string>;
  constructor(code: DomainErrorCode, message?: string, fields?: Record<string, string>) {
    super(message ?? code);
    this.name = "DomainError";
    this.code = code;
    this.fields = fields;
  }
}
