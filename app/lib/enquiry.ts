export type EnquiryInput = {
  idempotencyKey: string;
  name: string;
  phone: string;
  program: string;
  message: string;
};

export type EnquiryErrors = Partial<Record<"name" | "phone" | "program" | "message", string>>;

// Accepts 03xx..., +923xx... and 923xx... with spaces/dashes; returns it without separators, or null.
export function normalizePkMobile(raw: string): string | null {
  const phone = raw.replace(/[\s-]/g, "");
  return /^(\+?92|0)3\d{9}$/.test(phone) ? phone : null;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// Shape only: whether the program exists is checked against the database on submit.
export function parseEnquiry(form: FormData): { data?: EnquiryInput; errors?: EnquiryErrors } {
  const idempotencyKey = str(form.get("idempotencyKey"));
  const name = str(form.get("name"));
  const phone = normalizePkMobile(str(form.get("phone")));
  const program = str(form.get("program"));
  const message = str(form.get("message"));
  const errors: EnquiryErrors = {};

  if (!name) errors.name = "Enter your name.";
  else if (name.length > 80) errors.name = "Keep your name under 80 characters.";
  if (!phone) errors.phone = "Enter a Pakistani mobile number, like 0321 4220245.";
  if (!program) errors.program = "Pick what you want to join.";
  if (message.length > 500) errors.message = "Keep your message under 500 characters.";

  if (Object.keys(errors).length) return { errors };
  return { data: { idempotencyKey, name, phone: phone!, program, message } };
}
