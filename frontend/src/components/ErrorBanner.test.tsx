import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBanner } from "./ErrorBanner";

describe("ErrorBanner", () => {
  it("renders nothing when there is no message", () => {
    const { container } = render(<ErrorBanner message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message when present", () => {
    render(<ErrorBanner message="Failed to load data." />);
    expect(screen.getByText("Failed to load data.")).toBeInTheDocument();
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Something broke" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders no dismiss button when onDismiss is omitted", () => {
    render(<ErrorBanner message="Something broke" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
