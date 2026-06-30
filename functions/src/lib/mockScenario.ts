import type { Request, Response, NextFunction } from "express";

export function normalizePlate(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function readScenario(req: Request): string {
  const h = req.header("X-Mock-Scenario");
  return h || "ok";
}

export function applyScenario(scenario: string, res: Response, _next: NextFunction): boolean {
  if (scenario === "ok") return false;

  if (scenario === "not-found") {
    res.status(404).json({ error: "not_found" });
    return true;
  }
  if (scenario === "rate-limited") {
    res.set("Retry-After", "30");
    res.status(429).json({ error: "rate_limited" });
    return true;
  }
  if (scenario === "server-error") {
    res.status(500).json({ error: "upstream_error" });
    return true;
  }
  if (scenario === "unauthorized") {
    res.status(401).json({ error: "unauthorized" });
    return true;
  }
  if (scenario === "timeout") {
    // Just hang indefinitely to simulate a timeout
    return true;
  }

  return false;
}
