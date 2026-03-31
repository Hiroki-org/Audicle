import React from "react";
import { render, screen } from "@testing-library/react";
import { ArticleListSkeleton } from "../ArticleListSkeleton";

describe("ArticleListSkeleton", () => {
    it("renders without crashing", () => {
        render(<ArticleListSkeleton />);
        const skeletonContainer = screen.getByTestId("article-list-skeleton");
        expect(skeletonContainer).toBeInTheDocument();
    });

    it("renders exactly 5 skeleton cards", () => {
        render(<ArticleListSkeleton />);
        const skeletonCards = screen.getAllByTestId("article-skeleton-card");
        expect(skeletonCards).toHaveLength(5);
    });

    it("main container has correct grid classes", () => {
        render(<ArticleListSkeleton />);
        const skeletonContainer = screen.getByTestId("article-list-skeleton");
        expect(skeletonContainer).toHaveClass("grid", "grid-cols-1", "gap-4", "sm:gap-6", "lg:gap-8");
    });
});
