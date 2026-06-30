import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SummaryCard } from "./SummaryCard";
import type { RdwVehicleSummary } from "../lib/types";

function summary(over: Partial<RdwVehicleSummary> = {}): RdwVehicleSummary {
  return {
    kenteken: "12ABCD",
    found: true,
    make: "VOLKSWAGEN",
    model: "ID.3 Pro Performance",
    firstRegistration: "2022-03-09",
    firstNlRegistration: "2022-03-09",
    imported: false,
    apkValidUntil: "2026-08-14",
    apkValid: true,
    openRecall: false,
    liabilityInsured: true,
    exported: false,
    taxi: false,
    energyLabel: "A",
    ...over,
  };
}

describe("<SummaryCard />", () => {
  it("renders the dossier with a pretty-formatted plate", () => {
    render(<SummaryCard summary={summary()} />);
    expect(screen.getByText("12-AB-CD")).toBeInTheDocument();
    expect(screen.getByText(/VOLKSWAGEN ID\.3 Pro Performance/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-14/)).toBeInTheDocument();
  });

  it("flags imports with a badge", () => {
    render(<SummaryCard summary={summary({ imported: true })} />);
    expect(screen.getByText("imported")).toBeInTheDocument();
  });

  it("warns on open recall", () => {
    render(<SummaryCard summary={summary({ openRecall: true })} />);
    expect(screen.getByText(/check the recall record/i)).toBeInTheDocument();
  });

  it("renders a not-found state without a dossier", () => {
    render(<SummaryCard summary={summary({ found: false, kenteken: "ZZZZZZZ", make: null, model: null })} />);
    expect(screen.getByText(/isn't in the RDW registry/)).toBeInTheDocument();
    expect(screen.queryByText("imported")).not.toBeInTheDocument();
  });

  it("falls back to 'Unknown vehicle' when make and model are null", () => {
    render(<SummaryCard summary={summary({ make: null, model: null })} />);
    expect(screen.getByText("Unknown vehicle")).toBeInTheDocument();
  });
});
