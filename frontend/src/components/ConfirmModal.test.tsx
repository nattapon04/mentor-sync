import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmModal } from "./ConfirmModal";

describe("ConfirmModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmModal isOpen={false} title="Delete?" message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the title and message when open", () => {
    render(
      <ConfirmModal isOpen title="Delete user" message="This cannot be undone." onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("Delete user")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("calls onConfirm and then onCancel (auto-close) when confirmed", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmModal isOpen title="Delete user" message="Sure?" onConfirm={onConfirm} onCancel={onCancel} confirmText="Delete" />
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls only onCancel when cancelled", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmModal isOpen title="Delete user" message="Sure?" onConfirm={onConfirm} onCancel={onCancel} cancelText="Cancel" />
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
