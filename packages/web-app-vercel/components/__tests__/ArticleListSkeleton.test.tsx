import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ArticleListSkeleton } from "../ArticleListSkeleton";

describe("ArticleListSkeleton", () => {
    it("renders exactly 5 skeleton items", () => {
        render(<ArticleListSkeleton />);

        const skeletonItems = screen.getAllByTestId("article-list-skeleton-item");
        expect(skeletonItems).toHaveLength(5);
    });

    it("renders the correct inner skeleton structure for each item", () => {
        render(<ArticleListSkeleton />);

        const skeletonItems = screen.getAllByTestId("article-list-skeleton-item");

        // Assert count before iterating
        expect(skeletonItems).toHaveLength(5);

        skeletonItems.forEach((item) => {
            const titleContainer = within(item).getByTestId("skeleton-title-placeholders");
            // It should have 3 title/domain placeholder lines
            const titleDomainPlaceholders = titleContainer.querySelectorAll("div.animate-pulse");
            expect(titleDomainPlaceholders).toHaveLength(3);

            const actionContainer = within(item).getByTestId("skeleton-action-placeholders");
            // It should have 2 action button placeholders
            const actionButtonPlaceholders = actionContainer.querySelectorAll("div.animate-pulse");
            expect(actionButtonPlaceholders).toHaveLength(2);
        });
    });
});
