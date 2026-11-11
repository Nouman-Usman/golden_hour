import { Arrow } from "./arrow";
import { gym } from "./content";
import { formatPrice, getPlans, periodLabel } from "./lib/plans";

export async function Pricing() {
  const plans = await getPlans();
  const recurring = plans.filter((p) => p.period !== "one_time");
  const oneTime = plans.filter((p) => p.period === "one_time");

  return (
    <section id="pricing" className="px-4 py-24 sm:px-10 sm:py-32">
      <h2 data-fx="split" className="font-display text-6xl font-extrabold uppercase leading-[0.9] sm:text-8xl">
        Membership
      </h2>

      {recurring.length === 0 ? (
        <p className="mt-8 max-w-md text-lg text-bone/75">
          Fees are being updated.{" "}
          <a href={gym.whatsapp} className="text-brass-light underline underline-offset-4">
            Ask us on WhatsApp
          </a>{" "}
          for current prices.
        </p>
      ) : (
        <>
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {recurring.map((p) => (
              <li
                key={p.id}
                className={`flex flex-col gap-6 p-6 sm:p-8 ${p.highlighted ? "bg-brass text-matte" : "border border-ash/30"}`}
              >
                <h3 className="font-display text-3xl font-bold">{p.name}</h3>
                <p>
                  <span className={`font-display text-5xl font-black sm:text-6xl ${p.highlighted ? "" : "text-brass-light"}`}>
                    {formatPrice(p.price)}
                  </span>
                  <span className="ml-2 whitespace-nowrap opacity-75">{periodLabel[p.period]}</span>
                </p>
                {p.description && <p className="opacity-80">{p.description}</p>}
                {p.features.length > 0 && (
                  <ul className={`mt-auto border-t pt-5 ${p.highlighted ? "border-matte/25" : "border-ash/30"}`}>
                    {p.features.map((f) => (
                      <li key={f} className="py-1">
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <a href="#join" className={`btn btn-action justify-between ${p.highlighted ? "btn-dark" : "btn-outline"}`}>
                  Join with {p.name}
                  <span className="btn-icon">
                    <Arrow />
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {oneTime.map((p) => (
            <p key={p.id} className="mt-6 text-bone/70">
              Plus a {periodLabel[p.period]} {p.name.toLowerCase()} fee of {formatPrice(p.price)}.
            </p>
          ))}
        </>
      )}
    </section>
  );
}
