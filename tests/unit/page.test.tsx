import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the local-first map shell heading", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: /hello! my paso!/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dummy poi seed ready for map shell testing/i),
    ).toBeInTheDocument();
  });

  it("shows a safe fallback when mapbox is not configured", async () => {
    render(<HomePage />);

    expect(await screen.findByText(/map preview unavailable/i)).toBeInTheDocument();
    expect(await screen.findByText(/100 bundled dummy pois/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /focused poi/i })).toBeInTheDocument();
  });

  it("surfaces the local journal workflow once the bundled pois are ready", async () => {
    render(<HomePage />);

    expect(
      await screen.findByRole("heading", { name: /local journal/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /import local json/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /record local visit/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /profile snapshot/i }),
    ).toBeInTheDocument();
  });
});
