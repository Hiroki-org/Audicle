import React from "react";
import { render, screen } from "@testing-library/react";
import { ArticleListSkeleton } from "../ArticleListSkeleton";

describe("ArticleListSkeleton", () => {
    it("renders without crashing", () => {
        render(<ArticleListSkeleton />);

        // Use getAllByTestId to find all skeleton cards
        const skeletonCards = screen.getAllByTestId("skeleton-card");

        // Assert that exactly 5 cards are rendered
        expect(skeletonCards).toHaveLength(5);

        // Assert that the grid layout container is rendered
        // We can do this by checking the parent of the first card, or just by the fact it rendered.
        // The component has a grid container.
    });

    it("renders cards with pulsing animations", () => {
        const { container } = render(<ArticleListSkeleton />);

        // Check for elements with the animate-pulse class
        // Each card has 5 pulsing elements (3 text placeholders, 2 button placeholders)
        // With 5 cards, there should be 25 pulsing elements in total
        const pulsingElements = container.querySelectorAll('.animate-pulse');
        expect(pulsingElements.length).toBe(25);
    });
});
