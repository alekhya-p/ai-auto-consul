import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ChatMarkdown } from "./ChatMarkdown";

describe("ChatMarkdown", () => {
  it("renders **bold** as <strong>", () => {
    const { container } = render(<ChatMarkdown text="This is **important** info" />);
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("important");
  });

  it("renders *italic* as <em>", () => {
    const { container } = render(<ChatMarkdown text="A *small* note" />);
    const em = container.querySelector("em");
    expect(em?.textContent).toBe("small");
  });

  it("renders `inline code` as <code>", () => {
    const { container } = render(<ChatMarkdown text="The flag is `WOK`" />);
    const code = container.querySelector("code");
    expect(code?.textContent).toBe("WOK");
  });

  it("groups consecutive '- ' lines into a <ul>", () => {
    const text = "- First risk\n- Second risk\n- Third risk";
    const { container } = render(<ChatMarkdown text={text} />);
    const ul = container.querySelector("ul");
    expect(ul).not.toBeNull();
    expect(ul!.children.length).toBe(3);
    expect(ul!.children[0].textContent).toBe("First risk");
  });

  it("groups numbered '1. ' lines into an <ol>", () => {
    const text = "1. First\n2. Second";
    const { container } = render(<ChatMarkdown text={text} />);
    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
    expect(ol!.children.length).toBe(2);
  });

  it("treats blank lines as paragraph breaks", () => {
    const text = "First para.\n\nSecond para.";
    const { container } = render(<ChatMarkdown text={text} />);
    const paras = container.querySelectorAll("p");
    expect(paras.length).toBe(2);
  });

  it("handles bold inside a list item", () => {
    const { container } = render(<ChatMarkdown text="- **WOK status** confirmed" />);
    const strong = container.querySelector("li strong");
    expect(strong?.textContent).toBe("WOK status");
  });

  it("does not render literal markdown asterisks when matched", () => {
    const { container } = render(<ChatMarkdown text="**bold**" />);
    expect(container.textContent).toBe("bold");
  });

  it("leaves an unclosed asterisk as plain text", () => {
    const { container } = render(<ChatMarkdown text="A * leftover" />);
    expect(container.textContent).toBe("A * leftover");
  });

  it("renders empty string as nothing", () => {
    const { container } = render(<ChatMarkdown text="" />);
    expect(container.textContent).toBe("");
  });
});
