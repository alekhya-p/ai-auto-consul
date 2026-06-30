import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("./analytics", () => ({ track: (...a: unknown[]) => track(...a) }));

import { usePageViews } from "./usePageViews";

function Harness() {
  usePageViews();
  const navigate = useNavigate();
  return <button onClick={() => navigate("/foo?x=1")}>go</button>;
}

beforeEach(() => track.mockClear());

describe("usePageViews", () => {
  it("fires page_view on mount and on each navigation", () => {
    render(
      <MemoryRouter initialEntries={["/start"]}>
        <Harness />
      </MemoryRouter>,
    );
    expect(track).toHaveBeenCalledWith("page_view", { page_path: "/start" });
    fireEvent.click(screen.getByText("go"));
    expect(track).toHaveBeenCalledWith("page_view", { page_path: "/foo?x=1" });
  });
});
