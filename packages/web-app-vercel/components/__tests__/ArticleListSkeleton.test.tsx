import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ArticleListSkeleton } from "../ArticleListSkeleton";

describe("ArticleListSkeleton", () => {
    it("renders exactly 5 skeleton cards", () => {
        render(<ArticleListSkeleton />);
        const skeletonCards = screen.getAllByTestId("skeleton-card");
        expect(skeletonCards).toHaveLength(5);
    });

    it("renders five pulsing placeholders per card", () => {
        render(<ArticleListSkeleton />);

        const skeletonCards = screen.getAllByTestId("skeleton-card");
        skeletonCards.forEach((card) => {
            expect(within(card).getAllByTestId("skeleton-pulse")).toHaveLength(5);
        });
    });
});
