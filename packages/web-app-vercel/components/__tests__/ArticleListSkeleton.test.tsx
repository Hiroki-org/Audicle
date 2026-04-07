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
});
