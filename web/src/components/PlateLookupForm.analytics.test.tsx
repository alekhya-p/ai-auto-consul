import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("../lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));
// Avoid the async recents load touching IndexedDB in the test.
vi.mock("../lib/voertuigCache", () => ({
  normalise: (s: string) => s.replace(/[\s-]/g, "").toUpperCase(),
  getRecent: () => Promise.resolve([]),
  removeRecent: vi.fn(),
  clearRecent: vi.fn(),
  prettyPlate: (s: string) => s,
}));

import { PlateLookupForm } from "./PlateLookupForm";
import { LanguageProvider } from "../lib/i18n";

beforeEach(() => track.mockClear());

function renderForm(variant: "hero" | "compact") {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <PlateLookupForm variant={variant} showRecents={false} />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe("PlateLookupForm analytics", () => {
  it("fires plate_lookup with source=hero on a valid hero submit", () => {
    renderForm("hero");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "12-AB-345" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(track).toHaveBeenCalledWith("plate_lookup", { source: "hero" });
  });

  it("uses source=dashboard for the compact variant", () => {
    renderForm("compact");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "12-AB-345" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(track).toHaveBeenCalledWith("plate_lookup", { source: "dashboard" });
  });

  it("does not fire on an invalid (too short) submit", () => {
    renderForm("hero");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "1" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(track).not.toHaveBeenCalled();
  });
});
