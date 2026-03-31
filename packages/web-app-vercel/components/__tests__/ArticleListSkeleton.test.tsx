import React from "react";
import { render } from "@testing-library/react";
import { ArticleListSkeleton } from "../ArticleListSkeleton";

describe("ArticleListSkeleton", () => {
    it("renders exactly 5 skeleton items", () => {
        const { container } = render(<ArticleListSkeleton />);

        // The skeleton uses cards with specific classes
        const skeletonItems = container.querySelectorAll(".group.bg-zinc-900\\/50.border-zinc-800");
        expect(skeletonItems).toHaveLength(5);
    });

    it("renders the correct inner skeleton structure for each item", () => {
        const { container } = render(<ArticleListSkeleton />);

        const skeletonItems = container.querySelectorAll(".group.bg-zinc-900\\/50.border-zinc-800");

        // Check the structure of the first item as a representative
        const firstItem = skeletonItems[0];

        // It should have 3 title/domain placeholder lines
        const titleDomainPlaceholders = firstItem.querySelectorAll(".flex-1.min-w-0 > div.animate-pulse");
        expect(titleDomainPlaceholders).toHaveLength(3);

        // It should have 2 action button placeholders
        const actionButtonPlaceholders = firstItem.querySelectorAll(".flex.items-center.gap-2 > div.animate-pulse");
        expect(actionButtonPlaceholders).toHaveLength(2);
    });
});
