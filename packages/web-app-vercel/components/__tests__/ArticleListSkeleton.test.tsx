import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ArticleListSkeleton } from "../ArticleListSkeleton";

describe("ArticleListSkeleton", () => {
    it("renders five skeleton items with the expected placeholder structure", () => {
        render(<ArticleListSkeleton />);

        expect(screen.getByTestId("article-list-skeleton")).toHaveAttribute("aria-hidden", "true");

        const skeletonItems = screen.getAllByTestId("article-list-skeleton-item");
        expect(skeletonItems).toHaveLength(5);

        skeletonItems.forEach((item) => {
            expect(within(item).getAllByTestId("skeleton-title-placeholder")).toHaveLength(3);
            expect(within(item).getAllByTestId("skeleton-action-placeholder")).toHaveLength(2);
        });
    });
});
