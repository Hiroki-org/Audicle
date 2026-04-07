import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export function ArticleListSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8">
            {[...Array(5)].map((_, i) => (
                <Card key={i} className="relative group bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="h-6 w-3/4 bg-zinc-800 rounded animate-pulse mb-2" />
                                <div className="h-4 w-1/3 bg-zinc-800 rounded animate-pulse mb-3" />
                                <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 bg-zinc-800 rounded animate-pulse" />
                                <div className="h-8 w-8 bg-zinc-800 rounded animate-pulse" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
