import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the bottom navigation with four tabs", async () => {
    render(<HomePage />);

    const nav = await screen.findByRole("navigation");
    expect(nav).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /지도/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /저널/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /탐색/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /프로필/i }),
    ).toBeInTheDocument();
  });
});
