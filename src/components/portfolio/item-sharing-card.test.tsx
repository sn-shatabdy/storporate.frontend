import * as React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mocks MUST be hoisted before the component module is imported.
vi.mock("@/lib/api/portfolio", async () => {
  // Re-export the real module so the type imports still resolve, then
  // replace `updateItemSharing` with a vi.fn() the test bodies drive via
  // `mockResolvedValue` / `mockRejectedValue`. The other functions
  // (`listPortfolioItems`, etc.) are not used by the card itself but
  // some helpers in the file are.
  const actual =
    await vi.importActual<typeof import("@/lib/api/portfolio")>(
      "@/lib/api/portfolio",
    );
  return {
    ...actual,
    updateItemSharing: vi.fn(),
  };
});

import { updateItemSharing } from "@/lib/api/portfolio";
import { ApiError } from "@/lib/api/errors";

import { ItemSharingCard, type ItemSharingItem } from "./item-sharing-card";

/**
 * Tests for the STOR-44 Phase 3 "Employer access" card. Pins:
 *   - Off / On / Disabled status copy + switch state
 *   - The "Employers can see" panel content (File vs Link) + the
 *     "stays private" line
 *   - Optimistic toggle → PUT → onChanged callback → "Saving…" → "Saved."
 *   - Failure path: revert + "Could not save. Try again." alert
 *   - Second toggle after an error clears the error
 *   - Guard: rendered text in every state contains neither "evidence"
 *     nor "proof" (case-insensitive) and no em/en dashes
 */

const ACCESS_TOKEN = "test-access-token";

const FILE_ITEM: ItemSharingItem = {
  id: "item-001",
  submissionType: "File",
  originalFileName: "capstone.pdf",
  shareOriginalWithEmployers: false,
};

const LINK_ITEM: ItemSharingItem = {
  id: "item-002",
  submissionType: "Link",
  originalFileName: null,
  shareOriginalWithEmployers: false,
};

/** A "successful" response shape — the card's PUT mock returns this
 * whenever the call should succeed. Mirrors the real `PortfolioItem`
 * shape just well enough for the card's onChanged callback to receive a
 * non-null object. */
function successResponse(): Awaited<ReturnType<typeof updateItemSharing>> {
  return {
    id: "item-001",
    label: "Capstone Project Writeup",
    category: "Document",
    customCategoryText: null,
    submissionType: "File",
    originalFileName: "capstone.pdf",
    contentType: "application/pdf",
    fileSizeBytes: 1024 * 250,
    externalUrl: null,
    description: null,
    createdAt: "2026-09-10T00:00:00Z",
    analysisStatus: "Analyzed",
    lastAnalyzedAt: "2026-09-10T00:05:00Z",
    skills: [],
    shareOriginalWithEmployers: true,
  };
}

beforeEach(() => {
  // Reset the shared mock — `vi.resetAllMocks()` clears call history AND
  // resets any default implementation. We DON'T use `clearAllMocks`
  // because the spec asks for `resetAllMocks` (clearAllMocks would leave
  // any mockResolvedValue set on the mock in place).
  vi.resetAllMocks();
  vi.mocked(updateItemSharing).mockResolvedValue(successResponse());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ItemSharingCard — off state", () => {
  it("renders the off-state status copy and an unchecked switch", () => {
    render(
      <ItemSharingCard
        item={FILE_ITEM}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /Off\. Employers who find you see this item's title and skills only\./,
      ),
    ).toBeInTheDocument();
    const sw = screen.getByRole("switch", { name: /employer access/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).not.toBeDisabled();
  });

  it("does NOT render the 'Employers can see' panel when the switch is off", () => {
    render(
      <ItemSharingCard
        item={FILE_ITEM}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );
    expect(screen.queryByText(/employers can see/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/your description of this item stays private/i),
    ).not.toBeInTheDocument();
  });
});

describe("ItemSharingCard — on state", () => {
  it("renders the File on-state status copy and the file name in the panel", () => {
    render(
      <ItemSharingCard
        item={{ ...FILE_ITEM, shareOriginalWithEmployers: true }}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /On\. Employers who find you can open this file and read why each skill was rated\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The original file, capstone.pdf"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The written reason for each skill rating"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your description of this item stays private/i),
    ).toBeInTheDocument();
    const sw = screen.getByRole("switch", { name: /employer access/i });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("falls back to 'The original file' when the file name is missing", () => {
    render(
      <ItemSharingCard
        item={{
          ...FILE_ITEM,
          originalFileName: null,
          shareOriginalWithEmployers: true,
        }}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText("The original file")).toBeInTheDocument();
    expect(
      screen.queryByText(/the original file,\s*/i),
    ).not.toBeInTheDocument();
  });

  it("renders the Link on-state status copy and 'The original link'", () => {
    render(
      <ItemSharingCard
        item={{ ...LINK_ITEM, shareOriginalWithEmployers: true }}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /On\. Employers who find you can open this link and read why each skill was rated\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("The original link")).toBeInTheDocument();
    expect(
      screen.getByText("The written reason for each skill rating"),
    ).toBeInTheDocument();
  });
});

describe("ItemSharingCard — disabled state (not searchable)", () => {
  it("renders the disabled copy, the link, and a locked switch", () => {
    render(
      <ItemSharingCard
        item={FILE_ITEM}
        isSearchable={false}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );
    expect(
      screen.getByText(/Turn on employer visibility to use this\./),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /go to employer visibility/i });
    expect(link).toHaveAttribute("href", "/dashboard/visibility");
    const sw = screen.getByRole("switch", { name: /employer access/i });
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("does NOT render the 'Employers can see' panel in the disabled state", () => {
    render(
      <ItemSharingCard
        item={{ ...FILE_ITEM, shareOriginalWithEmployers: true }}
        isSearchable={false}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );
    expect(screen.queryByText(/employers can see/i)).not.toBeInTheDocument();
  });
});

describe("ItemSharingCard — toggle behaviour", () => {
  it("calls updateItemSharing exactly once with the new value and invokes onChanged on success", async () => {
    const onChanged = vi.fn();

    render(
      <ItemSharingCard
        item={FILE_ITEM}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={onChanged}
      />,
    );

    const sw = screen.getByRole("switch", { name: /employer access/i });
    fireEvent.click(sw);

    await waitFor(() => {
      expect(updateItemSharing).toHaveBeenCalledTimes(1);
    });
    expect(updateItemSharing).toHaveBeenCalledWith(
      ACCESS_TOKEN,
      FILE_ITEM.id,
      true,
      expect.anything(),
    );

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledWith(
        expect.objectContaining({ shareOriginalWithEmployers: true }),
      );
    });
  });

  it("shows 'Saving…' then 'Saved.' on success and auto-clears 'Saved.' after 3s", async () => {
    // Use fake timers AND gate which APIs we mock — we want only the
    // setTimeout used by the "Saved." cleanup to be fake, so that waitFor
    // can still use its real-time polling to observe transitions.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
    });

    // Use a manually-controlled deferred so we can observe the
    // in-flight "Saving…" state before the PUT resolves.
    let resolveUpdate!: (v: Awaited<ReturnType<typeof updateItemSharing>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof updateItemSharing>>>(
      (res) => {
        resolveUpdate = res;
      },
    );
    vi.mocked(updateItemSharing).mockReturnValueOnce(pending);

    render(
      <ItemSharingCard
        item={FILE_ITEM}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );

    const sw = screen.getByRole("switch", { name: /employer access/i });
    fireEvent.click(sw);

    // While the PUT is in flight the Saving line is on screen and the
    // switch is disabled.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(sw).toBeDisabled();

    // Resolve the PUT; Saving → Saved.
    await act(async () => {
      resolveUpdate(successResponse());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Saved.")).toBeInTheDocument();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();

    // Advance just before 3s — the line should still be there.
    await act(async () => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.queryByText("Saved.")).toBeInTheDocument();

    // Advance past 3s — the cleanup setTimeout fires and the line clears.
    await act(async () => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("reverts the switch and shows an alert on failure", async () => {
    vi.mocked(updateItemSharing).mockRejectedValueOnce(
      new ApiError("server_error", "boom", 500),
    );

    render(
      <ItemSharingCard
        item={FILE_ITEM}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );

    const sw = screen.getByRole("switch", { name: /employer access/i });
    fireEvent.click(sw);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not save\. try again\./i);

    // Switch reverted to the persisted value (off).
    await waitFor(() => {
      expect(sw).toHaveAttribute("aria-checked", "false");
    });
    expect(sw).not.toBeDisabled();

    // updateItemSharing was still called exactly once.
    expect(updateItemSharing).toHaveBeenCalledTimes(1);
  });

  it("a second toggle after an error clears the error message", async () => {
    vi.mocked(updateItemSharing)
      .mockRejectedValueOnce(new ApiError("server_error", "boom", 500))
      .mockResolvedValueOnce(successResponse());

    render(
      <ItemSharingCard
        item={FILE_ITEM}
        isSearchable={true}
        accessToken={ACCESS_TOKEN}
        onChanged={() => {}}
      />,
    );

    const sw = screen.getByRole("switch", { name: /employer access/i });
    fireEvent.click(sw);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not save\. try again\./i);

    fireEvent.click(sw);
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

describe("ItemSharingCard — copy guard", () => {
  const cases: Array<{ label: string; element: React.ReactElement }> = [
    {
      label: "off / file",
      element: (
        <ItemSharingCard
          item={FILE_ITEM}
          isSearchable={true}
          accessToken={ACCESS_TOKEN}
          onChanged={() => {}}
        />
      ),
    },
    {
      label: "on / file",
      element: (
        <ItemSharingCard
          item={{ ...FILE_ITEM, shareOriginalWithEmployers: true }}
          isSearchable={true}
          accessToken={ACCESS_TOKEN}
          onChanged={() => {}}
        />
      ),
    },
    {
      label: "on / link",
      element: (
        <ItemSharingCard
          item={{ ...LINK_ITEM, shareOriginalWithEmployers: true }}
          isSearchable={true}
          accessToken={ACCESS_TOKEN}
          onChanged={() => {}}
        />
      ),
    },
    {
      label: "disabled",
      element: (
        <ItemSharingCard
          item={FILE_ITEM}
          isSearchable={false}
          accessToken={ACCESS_TOKEN}
          onChanged={() => {}}
        />
      ),
    },
    {
      label: "disabled, parent already on",
      element: (
        <ItemSharingCard
          item={{ ...FILE_ITEM, shareOriginalWithEmployers: true }}
          isSearchable={false}
          accessToken={ACCESS_TOKEN}
          onChanged={() => {}}
        />
      ),
    },
  ];

  for (const { label, element } of cases) {
    it(`never says 'evidence'/'proof' and uses no em/en dashes in state '${label}'`, () => {
      const { container } = render(element);
      const text = container.textContent ?? "";
      expect(text.toLowerCase()).not.toMatch(/evidence|proof/);
      expect(text).not.toMatch(/[\u2014\u2013]/); // em dash + en dash
    });
  }
});
