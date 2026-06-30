import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: {
    ready: true,
    enabled: true,
    user: null as { uid: string; email?: string | null; displayName?: string | null } | null,
    idToken: null as string | null,
    tier: "free" as "free" | "pass" | "pro" | "power",
  },
  signOutCurrentMock: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => mocks.authState,
  signOutCurrent: mocks.signOutCurrentMock,
}));

vi.mock("../lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { SignInButton } from "./SignInButton";

const { authState, signOutCurrentMock } = mocks;

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <SignInButton />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  signOutCurrentMock.mockReset();
  authState.ready = true;
  authState.enabled = true;
  authState.user = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<SignInButton />", () => {
  it("renders nothing when Firebase is not configured", () => {
    authState.enabled = false;
    const { container } = renderWithRouter();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while auth is initializing", () => {
    authState.ready = false;
    const { container } = renderWithRouter();
    expect(container.firstChild).toBeNull();
  });

  it("shows a single Sign in link when signed out", () => {
    authState.user = null;
    renderWithRouter();
    const link = screen.getByRole("link", { name: /nav\.signIn/i });
    expect(link).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByRole("link", { name: /sign[- ]?up/i })).not.toBeInTheDocument();
  });

  it("shows a user menu when signed in", async () => {
    authState.user = { uid: "u1", email: "lotte@example.nl" };
    renderWithRouter();
    const trigger = screen.getByRole("button", { name: /nav\.userMenu/i });
    expect(trigger).toHaveTextContent("lotte@example.nl");
    await userEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: /nav\.dashboard/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("menuitem", { name: /nav\.signOut/i })).toBeInTheDocument();
  });

  it("calls signOutCurrent when Sign out is clicked", async () => {
    authState.user = { uid: "u1", email: "lotte@example.nl" };
    signOutCurrentMock.mockResolvedValue(undefined);
    renderWithRouter();
    await userEvent.click(screen.getByRole("button", { name: /nav\.userMenu/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /nav\.signOut/i }));
    expect(signOutCurrentMock).toHaveBeenCalledTimes(1);
  });
});
