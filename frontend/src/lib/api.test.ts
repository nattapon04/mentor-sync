import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { getErrorMessage } from "./api";

function makeAxiosError(status: number, body: unknown): AxiosError {
  return new AxiosError(
    "Request failed",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      status,
      statusText: "Error",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: body,
    }
  );
}

describe("getErrorMessage", () => {
  it("extracts the backend's {error: \"...\"} message from an axios error response", () => {
    const err = makeAxiosError(400, { error: "Validation failed: name is required" });
    expect(getErrorMessage(err)).toBe("Validation failed: name is required");
  });

  it("falls back to the axios error's own message when the response has no error field", () => {
    const err = makeAxiosError(500, {});
    expect(getErrorMessage(err)).toBe("Request failed");
  });

  it("returns the provided fallback for a non-axios, non-Error value", () => {
    expect(getErrorMessage("just a string", "custom fallback")).toBe("custom fallback");
  });

  it("uses the default fallback when none is provided", () => {
    expect(getErrorMessage(null)).toBe("Something went wrong. Please try again.");
  });

  it("uses a plain Error's message when it isn't an axios error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });
});
