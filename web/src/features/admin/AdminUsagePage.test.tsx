import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  getAdminUsage: vi.fn(),
}));

import { getAdminUsage } from "../../lib/api";
import { LanguageProvider } from "../../lib/i18n";
import { AdminUsagePage } from "./AdminUsagePage";

const mockGet = getAdminUsage as unknown as ReturnType<typeof vi.fn>;

const REPORT = {
  totals: { events: 5, credits: 2, turns: 2, uniqueUsers: 2, avgCreditsPerTurn: 1, avgToolsPerTurn: 1 },
  perTool: [{ toolName: "rdw_fetch", calls: 3, totalCost: 0, avgCost: 0 }],
  daily: [{ date: "2026-05-10", calls: 4, credits: 2, turns: 2 }],
  cacheStats: [{ source: "cache", hits: 2, misses: 1, hitRate: 0.6667 }],
  aiStats: [{ model: "gemini-2.5", calls: 1, avgInputTokens: 100, avgOutputTokens: 40, avgLatencyMs: 1000 }],
  truncated: false,
};

function renderPage() {
  return render(
    <LanguageProvider>
      <AdminUsagePage />
    </LanguageProvider>,
  );
}

describe("<AdminUsagePage />", () => {
  beforeEach(() => mockGet.mockReset());

  it("loads the report for the default 30-day window and renders its rows", async () => {
    mockGet.mockResolvedValue(REPORT);
    renderPage();

    await waitFor(() => expect(screen.getByText("gemini-2.5")).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledWith(30, expect.anything());
    // per-tool call count + AI telemetry model are unique values in the report
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a loading status until the report resolves", async () => {
    let resolve!: (r: typeof REPORT) => void;
    mockGet.mockReturnValue(new Promise<typeof REPORT>((res) => { resolve = res; }));
    renderPage();
    // Before resolution the loading status is shown.
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Resolve and confirm it swaps to the report content.
    await act(async () => {
      resolve(REPORT);
    });
    expect(screen.getByText("gemini-2.5")).toBeInTheDocument();
  });
});
