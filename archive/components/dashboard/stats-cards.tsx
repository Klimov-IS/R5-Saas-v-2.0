
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Product, Store, WithId } from "@/lib/types";
import { Star, MessageSquare, Package, BookUser } from "lucide-react";
import { useMemo } from "react";

type StatsCardsProps = {
  products: WithId<Product>[];
  store?: WithId<Store> | null;
};

export function StatsCards({ products, store }: StatsCardsProps) {
  const { totalReviews, totalChats } = useMemo(() => {
    return {
      totalReviews: store?.totalReviews ?? 0,
      totalChats: store?.totalChats ?? 0,
    };
  }, [store]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Всего товаров</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{products.length}</div>
          <p className="text-xs text-muted-foreground">в вашем магазине</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Всего отзывов</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalReviews}</div>
          <p className="text-xs text-muted-foreground">по всем товарам</p>
        </CardContent>
      </Card>
       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Всего диалогов</CardTitle>
          <BookUser className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalChats}</div>
          <p className="text-xs text-muted-foreground">
            с покупателями
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
