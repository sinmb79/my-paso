import { render, screen } from "@testing-library/react";

import { BottomNav } from "@/components/ui/BottomNav";

describe("BottomNav", () => {
  it("marks only the active tab as the current page while preserving all four tabs", () => {
    render(<BottomNav activeTab="journal" onTabChange={vi.fn()} />);

    const journal = screen.getByRole("button", { name: "저널" });
    const map = screen.getByRole("button", { name: "지도" });
    const explore = screen.getByRole("button", { name: "탐색" });
    const profile = screen.getByRole("button", { name: "프로필" });

    expect(journal).toHaveAttribute("aria-current", "page");
    expect(map).not.toHaveAttribute("aria-current");
    expect(explore).not.toHaveAttribute("aria-current");
    expect(profile).not.toHaveAttribute("aria-current");
  });
});
