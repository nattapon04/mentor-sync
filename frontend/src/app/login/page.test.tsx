import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import Login from "./page";
import api from "@/lib/api";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api", () => ({
  default: { post: vi.fn() },
  getErrorMessage: (err: unknown, fallback: string) => {
    const anyErr = err as { response?: { data?: { error?: string } } };
    return anyErr?.response?.data?.error ?? fallback;
  },
}));

describe("Login page", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.mocked(api.post).mockReset();
    localStorage.clear();
  });

  it("renders the email/password form", () => {
    renderWithProviders(<Login />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("logs in and redirects based on role on success", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { token: "test-token", user: { id: "1", name: "Ann", email: "ann@example.com", roles: ["mentee"] } },
    });

    renderWithProviders(<Login />);
    await userEvent.type(screen.getByLabelText(/email address/i), "ann@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/my-dashboard"));
    expect(api.post).toHaveBeenCalledWith("/auth/login", { email: "ann@example.com", password: "correct-password" });
  });

  it("shows an error banner on failed login instead of silently failing", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { error: "Invalid email or password" } },
    });

    renderWithProviders(<Login />);
    await userEvent.type(screen.getByLabelText(/email address/i), "ann@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
