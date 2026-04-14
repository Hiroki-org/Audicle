/** @jest-environment jsdom */
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaybackSpeedDial } from "../PlaybackSpeedDial";

describe("PlaybackSpeedDial", () => {
  const defaultProps = {
    open: true,
    value: 1.0,
    onValueChange: jest.fn(),
    onOpenChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock DOM methods not available in JSDOM
    window.HTMLElement.prototype.setPointerCapture = jest.fn();
    window.HTMLElement.prototype.releasePointerCapture = jest.fn();
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(<PlaybackSpeedDial {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders correctly when open is true", () => {
    render(<PlaybackSpeedDial {...defaultProps} />);
    expect(screen.getByText("再生速度")).toBeInTheDocument();
    // The slider container and the current speed text.
    expect(screen.getByRole("slider")).toBeInTheDocument();
    // We expect "1.0x" to be found as the current speed label and option
    const elements = screen.getAllByText("1.0x");
    expect(elements.length).toBeGreaterThan(0);
  });

  it("calls onOpenChange with false when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<PlaybackSpeedDial {...defaultProps} />);

    // The backdrop is the outermost div with fixed inset-0
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onValueChange and onOpenChange when a speed option is clicked", async () => {
    const user = userEvent.setup();
    render(<PlaybackSpeedDial {...defaultProps} />);

    // Find a specific speed option via the confirmed data-testid
    const option = screen.getByTestId("speed-option-1.2");
    await user.click(option);

    expect(defaultProps.onValueChange).toHaveBeenCalledWith(expect.closeTo(1.2, 5));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange with false when Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<PlaybackSpeedDial {...defaultProps} />);

    await user.keyboard("{Escape}");

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles keyboard navigation on the slider", async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();

    function StatefulDial() {
      const [value, setValue] = useState(1.0);
      return (
        <PlaybackSpeedDial
          open={true}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            onValueChange(next);
          }}
          onOpenChange={defaultProps.onOpenChange}
        />
      );
    }

    render(<StatefulDial />);

    const slider = screen.getByRole("slider");
    slider.focus();

    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith(expect.closeTo(1.1, 5));

    await user.keyboard("{ArrowLeft}");
    expect(onValueChange).toHaveBeenLastCalledWith(expect.closeTo(1.0, 5));

    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith(expect.closeTo(0.8, 5));

    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith(expect.closeTo(3.0, 5));
  });

  it("handles dragging interactions on the slider", () => {
    render(<PlaybackSpeedDial {...defaultProps} />);
    const slider = screen.getByRole("slider");

    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 123, buttons: 1 });

    // The component might get the pointerId from e.pointerId or it might not be passed cleanly by jsdom.
    expect(window.HTMLElement.prototype.setPointerCapture).toHaveBeenCalled();

    // Move left (simulating decreasing speed)
    fireEvent.pointerMove(slider, { clientX: 50, pointerId: 123, buttons: 1 });

    fireEvent.pointerUp(slider, { pointerId: 123 });

    expect(defaultProps.onValueChange).toHaveBeenCalledTimes(1);
    const dragValue = defaultProps.onValueChange.mock.calls[0]?.[0];
    if (typeof dragValue === "number") {
      expect(dragValue).toBeCloseTo(1.1, 5);
    }
  });
});
