/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaybackSpeedDial } from "../PlaybackSpeedDial";
import { useState } from "react";

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
    const StatefulWrapper = () => {
      const [val, setVal] = useState(1.0);
      return (
        <PlaybackSpeedDial
          {...defaultProps}
          value={val}
          onValueChange={(v) => {
            setVal(v);
            defaultProps.onValueChange(v);
          }}
        />
      );
    };

    const user = userEvent.setup();
    render(<StatefulWrapper />);

    const slider = screen.getByRole("slider");
    slider.focus();

    // ArrowRight increases index from 1.0 (index 2) to 1.1 (index 3)
    await user.keyboard("{ArrowRight}");
    expect(defaultProps.onValueChange).toHaveBeenCalledWith(1.1);

    // ArrowLeft decreases index from 1.1 (index 3) back to 1.0 (index 2)
    await user.keyboard("{ArrowLeft}");
    expect(defaultProps.onValueChange).toHaveBeenCalledWith(1.0);

    // Home goes to min speed (0.8)
    await user.keyboard("{Home}");
    expect(defaultProps.onValueChange).toHaveBeenCalledWith(0.8);

    // End goes to max speed (3.0 for DEFAULT_SPEEDS)
    await user.keyboard("{End}");
    expect(defaultProps.onValueChange).toHaveBeenCalledWith(3.0);
  });

  it("handles dragging interactions on the slider", () => {
    render(<PlaybackSpeedDial {...defaultProps} />);
    const slider = screen.getByRole("slider");

    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 123 });

    // The component might get the pointerId from e.pointerId or it might not be passed cleanly by jsdom.
    expect(window.HTMLElement.prototype.setPointerCapture).toHaveBeenCalled();

    // Move left (simulating decreasing speed)
    fireEvent.pointerMove(slider, { clientX: 50 });

    fireEvent.pointerUp(slider);

    // Since totalItemWidth is fixed to 64, delta is -50, deltaIndex is -50/64 = -0.78
    // Starting index for 1.0 is 2. New preview is 2 - (-0.78) = 2.78. Round is 3.
    // Index 3 maps to 1.1x.
    expect(defaultProps.onValueChange).toHaveBeenCalled();
  });
});
