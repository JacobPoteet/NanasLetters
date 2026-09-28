// Resolves the newsletter's tracking-redirect link (extracted by
// findMeditationLinkHref) to the real, public cac.org URL, once, at
// ingestion time — never stores or re-visits the tracking link itself.
//
// Why resolve instead of guessing a URL from the meditation title: cac.org's
// own slugs aren't a clean function of the title. "blessed-are-the-peacemakers"
// redirects to "blessed-are-the-peacemakers-2018-02-06" (disambiguated by
// date), while "radical-resilience" resolves to a DIFFERENT page — that
// year's overarching theme, not the one specific day's meditation — because
// the theme reuses the same title. Guessing risks linking to a plausible but
// wrong page and nobody noticing; resolving the exact link CAC put in that
// day's actual email doesn't have that failure mode.

export async function resolveMeditationUrl(trackingHref: string): Promise<string | null> {
  try {
    const res = await fetch(trackingHref, { method: "HEAD", redirect: "follow" });
    // A tracking redirector answering with an error after following through
    // is still a resolved (if broken) destination; only a network failure
    // (thrown below) means we truly have nothing to link to.
    return res.url || null;
  } catch {
    return null;
  }
}
