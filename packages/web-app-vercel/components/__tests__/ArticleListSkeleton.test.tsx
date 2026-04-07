import React from "react";
import { render, screen } from "@testing-library/react";
import { ArticleListSkeleton } from "../ArticleListSkeleton";

describe("ArticleListSkeleton", () => {
    it("renders a loading status container", () => {
        render(<ArticleListSkeleton />);
        expect(screen.getByRole("status", { name: /loading articles/i })).toBeInTheDocument();
    });

    it("renders exactly 5 skeleton cards", () => {
        render(<ArticleListSkeleton />);
        const skeletonCards = screen.getAllByTestId("article-skeleton-card");
        expect(skeletonCards).toHaveLength(5);
    });
});
