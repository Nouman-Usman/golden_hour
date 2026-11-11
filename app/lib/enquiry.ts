export const sessions = ["Open floor", "Personal training", "Women's sessions", "Transformation"] as const;

export type Enquiry = {
  name: string;
  phone: string;
  session: (typeof sessions)[number];
  message: string;
};

export type Errors = Partial<Record<keyof Enquiry, string>>;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export function parseEnquiry(form: FormData): { data?: Enquiry; errors?: Errors } {
  const name = str(form.get("name"));
  const phone = str(form.get("phone")).replace(/[\s-]/g, "");
  const session = str(form.get("session"));
  const message = str(form.get("message"));
  const errors: Errors = {};

  if (!name) errors.name = "Enter your name.";
  else if (name.length > 80) errors.name = "Keep your name under 80 characters.";
  // Accepts 03xx..., +923xx... and 923xx... mobile formats.
  if (!/^(\+?92|0)3\d{9}$/.test(phone)) errors.phone = "Enter a Pakistani mobile number, like 0321 4220245.";
  if (!sessions.includes(session as Enquiry["session"])) errors.session = "Pick what you want to join.";
  if (message.length > 500) errors.message = "Keep your message under 500 characters.";

  if (Object.keys(errors).length) return { errors };
  return { data: { name, phone, session: session as Enquiry["session"], message } };
}
