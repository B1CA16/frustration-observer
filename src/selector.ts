// Describes an element as a CSS selector, so an event can be logged or sent
// somewhere without the consumer writing this first.
//
// The rule is deliberately plain: an id wins, otherwise the element is
// described by its position, walking up until an ancestor has an id or the
// path reaches its depth limit. Classes are left out on purpose. A utility
// class stack turns a selector into noise, and the structural path is
// predictable in a way class names are not.

/** Ids that can be written as `#value` rather than an attribute match. */
const SIMPLE_ID = /^[A-Za-z_-][\w-]*$/;

/** Long paths stop being readable, and readability is the point. */
const MAX_DEPTH = 4;

function byId(element: Element): string | null {
  const id = element.id;
  if (!id) return null;
  return SIMPLE_ID.test(id) ? `#${id}` : `[id="${id.replace(/"/g, '\\"')}"]`;
}

/** The element's tag, numbered only when a sibling shares that tag. */
function byPosition(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) return tag;

  const sameTag = [...parent.children].filter(
    (child) => child.tagName === element.tagName,
  );
  if (sameTag.length < 2) return tag;

  return `${tag}:nth-of-type(${sameTag.indexOf(element) + 1})`;
}

/**
 * A CSS selector for the element, such as `#buy` or
 * `#checkout > div > button:nth-of-type(2)`. The result always matches the
 * element it describes, though on a deep tree it may match earlier elements
 * too: the depth limit trades absolute precision for something readable in a
 * log.
 */
export function selectorFor(element: Element): string {
  const id = byId(element);
  if (id) return id;

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && parts.length < MAX_DEPTH) {
    const ancestorId = current === element ? null : byId(current);
    if (ancestorId) {
      parts.unshift(ancestorId);
      return parts.join(" > ");
    }

    parts.unshift(byPosition(current));
    // `body` is as far up as anyone needs; `html` above it says nothing.
    if (current.tagName === "BODY") break;
    current = current.parentElement;
  }

  return parts.join(" > ");
}
