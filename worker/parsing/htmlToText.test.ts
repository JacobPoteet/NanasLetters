import { describe, expect, it } from "vitest";
import { htmlToText, stripStyleAndScript } from "./htmlToText";

describe("stripStyleAndScript", () => {
  it("removes a style block entirely, including @media rules", () => {
    // This is the actual bug found during the parsing experiment: a Sept 2026
    // sample's <style> block (with @media queries) leaked into the "plain
    // text" as visible junk because the conversion used to sample it didn't
    // drop style content.
    const html = `<style>@media only screen and (min-width:620px){.foo{color:red}}</style><p>Hello</p>`;
    expect(stripStyleAndScript(html)).toBe("<p>Hello</p>");
  });

  it("removes a script block entirely", () => {
    const html = `<script>alert("hi")</script><p>Hello</p>`;
    expect(stripStyleAndScript(html)).toBe("<p>Hello</p>");
  });

  it("leaves ordinary markup untouched", () => {
    const html = `<p>Hello <b>world</b></p>`;
    expect(stripStyleAndScript(html)).toBe(html);
  });
});

describe("htmlToText", () => {
  it("drops style junk and keeps the real content", () => {
    const html = `<style>@media (min-width:620px){body{margin:0}}</style><p>The coffee was still warm.</p>`;
    expect(htmlToText(html)).toBe("The coffee was still warm.");
  });

  it("turns block boundaries and <br> into newlines", () => {
    const html = `<p>First paragraph.</p><p>Second paragraph.<br>Second line.</p>`;
    expect(htmlToText(html)).toBe("First paragraph.\nSecond paragraph.\nSecond line.");
  });

  it("strips remaining inline tags without losing their text", () => {
    const html = `<p>The <b>coffee</b> was <i>still warm</i>.</p>`;
    expect(htmlToText(html)).toBe("The coffee was still warm.");
  });

  it("decodes common named and numeric entities", () => {
    const html = `<p>Rock &amp; roll &mdash; caf&#233; &#x2019;99</p>`;
    expect(htmlToText(html)).toBe("Rock & roll — café ’99");
  });

  it("collapses runs of blank lines left behind by stripped tags", () => {
    const html = `<div></div><div></div><div></div><p>Hello</p>`;
    expect(htmlToText(html)).toBe("Hello");
  });
});
