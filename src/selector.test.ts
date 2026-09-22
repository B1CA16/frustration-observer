import { beforeEach, describe, expect, it } from "vitest";

import { selectorFor } from "./selector.js";

function render(html: string): void {
  document.body.innerHTML = html;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("selectorFor", () => {
  it("uses the id when the element has one", () => {
    render(`<main><button id="buy">Buy</button></main>`);

    expect(selectorFor(document.getElementById("buy")!)).toBe("#buy");
  });

  it("writes an awkward id as an attribute so it stays valid", () => {
    render(`<button id="2-buy">Buy</button>`);

    expect(selectorFor(document.querySelector("button")!)).toBe(`[id="2-buy"]`);
  });

  it("falls back to the tag name", () => {
    render(`<main><button>Buy</button></main>`);

    expect(selectorFor(document.querySelector("button")!)).toBe(
      "body > main > button",
    );
  });

  it("numbers elements that share a tag with a sibling", () => {
    render(`<nav><a>one</a><a>two</a><a>three</a></nav>`);

    const links = document.querySelectorAll("a");
    expect(selectorFor(links[1]!)).toContain("a:nth-of-type(2)");
  });

  it("does not number an element that is the only one of its tag", () => {
    render(`<nav><a>one</a><span>two</span></nav>`);

    expect(selectorFor(document.querySelector("a")!)).not.toContain(
      "nth-of-type",
    );
  });

  it("stops at the nearest ancestor with an id", () => {
    render(`<main id="checkout"><div><button>Buy</button></div></main>`);

    expect(selectorFor(document.querySelector("button")!)).toBe(
      "#checkout > div > button",
    );
  });

  it("keeps the path short on a deeply nested element", () => {
    render(
      `<div><div><div><div><div><button>Buy</button></div></div></div></div></div>`,
    );

    const selector = selectorFor(document.querySelector("button")!);
    expect(selector.split(" > ").length).toBeLessThanOrEqual(4);
  });

  it("describes an element that is not in the document", () => {
    const orphan = document.createElement("button");

    expect(selectorFor(orphan)).toBe("button");
  });

  it("returns a selector that finds the element again", () => {
    render(`
      <main id="checkout">
        <section>
          <div><button>first</button></div>
          <div><button>second</button></div>
        </section>
        <footer><a href="#">help</a></footer>
      </main>
      <aside><button>elsewhere</button></aside>
    `);

    for (const element of document.querySelectorAll("button, a, section")) {
      const selector = selectorFor(element);
      expect(document.querySelector(selector), selector).toBe(element);
    }
  });
});
