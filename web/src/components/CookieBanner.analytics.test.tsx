import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setAnalyticsConsent = vi.fn();
vi.mock("../lib/analytics", () => ({
  setAnalyticsConsent: (...a: unknown[]) => setAnalyticsConsent(...a),
}));

import { CookieBanner } from "./CookieBanner";
import { LanguageProvider } from "../lib/i18n";

beforeEach(() => {
  setAnalyticsConsent.mockClear();
  window.localStorage.clear();
});

function renderBanner() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe("CookieBanner analytics consent", () => {
  it("grants analytics consent when the user accepts", () => {
    const { container } = renderBanner();
    fireEvent.click(container.querySelector("button.primary")!);
    expect(setAnalyticsConsent).toHaveBeenLastCalledWith(true);
  });

  it("denies analytics consent when the user declines", () => {
    const { container } = renderBanner();
    fireEvent.click(container.querySelector("button.ghost")!);
    expect(setAnalyticsConsent).toHaveBeenLastCalledWith(false);
  });
});
