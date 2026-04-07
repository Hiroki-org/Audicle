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
        expect(skeletonItems).toHaveLength(5);

        skeletonItems.forEach((item) => {
            expect(within(item).getAllByTestId("article-list-skeleton-line")).toHaveLength(3);
            expect(within(item).getAllByTestId("article-list-skeleton-action")).toHaveLength(2);
        });
    });
});
