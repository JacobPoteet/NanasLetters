import { describe, expect, it } from "vitest";
import { extractLetter, findMeditationLinkHref, type RawMessage } from "./extractLetter";

function message(overrides: Partial<RawMessage>): RawMessage {
  return {
    gmailMessageId: "msg-1",
    date: "2024-09-27",
    subject: "Fw: Richard Rohr's Daily Meditation: Radical Resilience",
    plainTextBody: null,
    htmlBody: null,
    ...overrides,
  };
}

describe("extractLetter", () => {
  it("splits on the 2018-era '-----Original Message-----' marker", () => {
    const body = [
      "I couldn't have said it better myself this morning.",
      "",
      "-----Original Message-----",
      "From: Center for Action and Contemplation <meditations@cac.org>",
      "To: Nancie Shillington <nmshill@aol.com>",
      "Sent: Tue, Feb 6, 2018 2:04 am",
      "Subject: Richard Rohr Meditation: Blessed Are the Peacemakers",
      "",
      "There is no way to peace other than through peacemaking itself.",
    ].join("\n");
    const result = extractLetter(
      message({ plainTextBody: body, subject: "Fwd: Richard Rohr Meditation: Blessed Are the Peacemakers" }),
    );
    expect(result.text).toBe("I couldn't have said it better myself this morning.");
    expect(result.needsReview).toBe(false);
    expect(result.meditationTitle).toBe("Blessed Are the Peacemakers");
  });

  it("splits on the 2023+ '----- Forwarded Message -----' marker", () => {
    const body = [
      "The tomatoes finally came in this week.",
      "",
      "----- Forwarded Message -----",
      "From: Center for Action and Contemplation <meditations@cac.org>",
      "To: Nancie Shillington <nmshill@aol.com>",
      "Sent: Sunday, September 27, 2026 at 02:08:29 AM EDT",
      "Subject: Richard Rohr's Daily Meditation: An Influential Teacher",
      "",
      "Thérèse of Lisieux is an antidote to any spirituality of perfectionism.",
    ].join("\n");
    const result = extractLetter(message({ plainTextBody: body }));
    expect(result.text).toBe("The tomatoes finally came in this week.");
    expect(result.needsReview).toBe(false);
  });

  it("takes the EARLIEST quoted block when a letter forwards a forward of a forward", () => {
    const body = [
      "I don't have her permission but this felt too related not to share.",
      "",
      "----- Forwarded Message -----",
      "From: A Friend <friend@example.com>",
      "",
      "Did you see this?",
      "",
      "-----Original Message-----",
      "From: Center for Action and Contemplation <meditations@cac.org>",
      "",
      "The meditation text itself.",
    ].join("\n");
    const result = extractLetter(message({ plainTextBody: body }));
    expect(result.text).toBe("I don't have her permission but this felt too related not to share.");
    expect(result.needsReview).toBe(false);
  });

  it("falls back to the HTML body and strips CSS junk when there's no plain-text part", () => {
    const html =
      "<style>@media only screen and (min-width:620px){.foo{color:red}}</style>" +
      "<p>The coffee was still warm this morning.</p>" +
      "<p>----- Forwarded Message -----<br>From: Center for Action and Contemplation &lt;meditations@cac.org&gt;</p>" +
      "<p>Some meditation content.</p>";
    const result = extractLetter(message({ htmlBody: html }));
    expect(result.text).toBe("The coffee was still warm this morning.");
    expect(result.needsReview).toBe(false);
  });

  it("flags for review when no known forward marker is found", () => {
    const body = "Just a normal note today, nothing forwarded beneath it.";
    const result = extractLetter(message({ plainTextBody: body }));
    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toBe("no_forward_marker");
    // Still keeps the whole body — better a human trims it than we silently drop it.
    expect(result.text).toBe(body);
  });

  it("flags for review when the subject doesn't match the expected meditation-forward shape", () => {
    const body = ["Sharing something different today.", "", "-----Original Message-----", "From: A Friend"].join(
      "\n",
    );
    const result = extractLetter(message({ plainTextBody: body, subject: "Fwd: Something else entirely" }));
    expect(result.needsReview).toBe(true);
    expect(result.reviewReason).toBe("unexpected_subject");
    expect(result.meditationTitle).toBeNull();
  });

  it("prefers the no_forward_marker reason when both problems occur", () => {
    const result = extractLetter(message({ plainTextBody: "No marker at all here.", subject: "Hi everyone" }));
    expect(result.reviewReason).toBe("no_forward_marker");
  });

  it("matches the 2018 subject shape without an apostrophe-s", () => {
    const result = extractLetter(
      message({
        subject: "Fwd: Richard Rohr Meditation: Mirroring the Divine Image",
        plainTextBody: "Note.\n\n-----Original Message-----\nFrom: x",
      }),
    );
    expect(result.meditationTitle).toBe("Mirroring the Divine Image");
    expect(result.needsReview).toBe(false);
  });

  it("picks up the meditation link href when the HTML body has one", () => {
    const html =
      '<p>Note.</p><a href="https://email.cac.org/t/d-l-wjjudhk-tlkrtkdrx-y/">READ ON CAC.ORG</a>' +
      '<a href="https://email.cac.org/t/d-u-wjjudhk-tlkrtkdrx-yk/">Unsubscribe</a>';
    const result = extractLetter(message({ htmlBody: html }));
    expect(result.meditationLinkHref).toBe("https://email.cac.org/t/d-l-wjjudhk-tlkrtkdrx-y/");
  });

  it("is null when there's no HTML body at all (2018-era, embedded fully as plain text)", () => {
    const result = extractLetter(message({ plainTextBody: "Note.\n\n-----Original Message-----\nFrom: x" }));
    expect(result.meditationLinkHref).toBeNull();
  });
});

describe("findMeditationLinkHref", () => {
  it("matches the 2026-era 'READ ON CAC.ORG' button", () => {
    const html = '<a href="https://email.cac.org/t/d-l-x-y/">READ ON CAC.ORG</a>';
    expect(findMeditationLinkHref(html)).toBe("https://email.cac.org/t/d-l-x-y/");
  });

  it("matches the 2023-era 'Read this meditation on cac.org.' wording", () => {
    const html = '<a href="https://email.cac.org/t/d-l-a-b/">Read this meditation on cac.org.</a>';
    expect(findMeditationLinkHref(html)).toBe("https://email.cac.org/t/d-l-a-b/");
  });

  it("ignores every other link in the newsletter (unsubscribe, social, footer)", () => {
    const html = [
      '<a href="https://email.cac.org/t/d-u-x/">Unsubscribe</a>',
      '<a href="https://email.cac.org/t/d-fb-x/">Like</a>',
      '<a href="https://email.cac.org/t/d-l-x/">Learn more</a>',
    ].join("");
    expect(findMeditationLinkHref(html)).toBeNull();
  });

  it("returns null for null or empty HTML", () => {
    expect(findMeditationLinkHref(null)).toBeNull();
    expect(findMeditationLinkHref("")).toBeNull();
  });

  it("is safe to call repeatedly (the anchor regex must not carry state across calls)", () => {
    const html = '<a href="https://email.cac.org/t/d-l-x/">READ ON CAC.ORG</a>';
    expect(findMeditationLinkHref(html)).toBe("https://email.cac.org/t/d-l-x/");
    expect(findMeditationLinkHref(html)).toBe("https://email.cac.org/t/d-l-x/");
  });
});
