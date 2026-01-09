

"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Product, Review, Store, WithId } from "@/lib/types";
import { Star, MessageSquare, Calendar, ThumbsUp, ThumbsDown, MessageSquareReply, ShieldAlert, Camera, Video } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { useFirestore } from "@/firebase";
import { collection, getDocs, query, orderBy, where, writeBatch } from "firebase/firestore";
import { cn } from "@/lib/utils";

const complaintReasons: { [key: number]: string } = {
    11: "Отзыв не относится к товару",
    12: "Отзыв оставлен конкурентами",
    13: "Спам / реклама в тексте",
    14: "Спам-реклама на фото или видео",
    15: "Неприемлемое содержимое на фото/видео",
    16: "Неприемлемый текст / нецензурная лексика",
    17: "Фото/видео не относится к товару",
    18: "Отзыв с политическим контекстом",
    19: "Другое",
    20: "Угрозы / оскорбления",
};

const getComplaintText = (valuationCode: number | null | undefined): string | null => {
    return valuationCode ? complaintReasons[valuationCode] || `Неизвестная причина (код: ${valuationCode})` : null;
}

type ReviewsSheetProps = {
  product: WithId<Product> | null;
  store: WithId<Store> | null;
  onOpenChange: (open: boolean) => void;
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? "text-accent fill-accent" : "text-muted-foreground"
        }`}
      />
    ))}
  </div>
);

export function ReviewsSheet({ product, store, onOpenChange }: ReviewsSheetProps) {
  const [isReviewsLoading, setIsLoadingReviews] = useState(false);
  const firestore = useFirestore();

  const [reviews, setReviews] = useState<WithId<Review>[]>([]);
  const [ratingFilter, setRatingFilter] = useState("all");

  useEffect(() => {
    if (product && store && firestore) {
      const getReviewsForProduct = async (
        storeId: string,
        productId: string
      ): Promise<WithId<Review>[]> => {
          try {
              const reviewsRef = collection(firestore, `stores/${storeId}/products/${productId}/reviews`);
              const q = query(reviewsRef, orderBy("date", "desc"));
              const snapshot = await getDocs(q);
              if (snapshot.empty) return [];

              return snapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...(doc.data() as Review),
              }));
          } catch (error) {
              console.error(`[CLIENT-SIDE ERROR] in getReviewsForProduct for product ${productId}:`, error);
              return [];
          }
      }

      setReviews([]);
      setIsLoadingReviews(true);
      getReviewsForProduct(store.id, product.id)
        .then((data) => {
            const sortedData = data.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
            setReviews(sortedData);
        })
        .finally(() => setIsLoadingReviews(false));
    }
  }, [product, store, firestore]);

  const filteredReviews = useMemo(() => {
    if (!reviews) return [];
    return reviews.filter((review) => {
        if (ratingFilter === "all") return true;
        return review.rating === parseInt(ratingFilter, 10);
      }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [reviews, ratingFilter]);

  const isLoading = isReviewsLoading;

  return (
    <Sheet open={!!product} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl flex flex-col">
        <SheetHeader className="pr-8">
          <SheetTitle className="text-2xl font-headline">
            {product?.name ?? "Загрузка..."}
          </SheetTitle>
          <SheetDescription>
            Отзывы о товаре
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <TooltipProvider>
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="space-y-6 p-4">
              <Skeleton className="h-10 w-48" />
              <div className="space-y-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4 md:p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Отзывы ({filteredReviews.length})
                    </h3>
                    <div className="flex items-center gap-4">
                        <Select
                        value={ratingFilter}
                        onValueChange={setRatingFilter}
                        >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Фильтр по оценке" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все оценки</SelectItem>
                            <SelectItem value="5">5 звезд</SelectItem>
                            <SelectItem value="4">4 звезды</SelectItem>
                            <SelectItem value="3">3 звезды</SelectItem>
                            <SelectItem value="2">2 звезды</SelectItem>
                            <SelectItem value="1">1 звезда</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                  </div>
                  {filteredReviews.length > 0 ? (
                    <div className="space-y-4">
                      {filteredReviews.map((review) => {
                        const hasAnswer = !!review.answer;
                        const feedbackComplaint = getComplaintText(review.supplierFeedbackValuation);
                        const productComplaint = getComplaintText(review.supplierProductValuation);

                        return (
                        <Card key={review.id} className={cn(
                            "transition-all",
                            review.rating <= 3 ? "border-red-500/50 hover:border-red-500/80" : "border-green-500/50 hover:border-green-500/80"
                        )}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <StarRating rating={review.rating} />
                                  {review.rating <= 3 ? (
                                    <Badge variant="destructive" className="gap-1.5 pl-1.5 pr-2.5 py-1 text-xs">
                                        <ThumbsDown className="h-3.5 w-3.5" />
                                        Негативный
                                    </Badge>
                                  ) : (
                                     <Badge variant="secondary" className="gap-1.5 pl-1.5 pr-2.5 py-1 text-xs border-green-500/50 text-green-700">
                                        <ThumbsUp className="h-3.5 w-3.5" />
                                        Позитивный
                                    </Badge>
                                  )}
                                  {(review.photoLinks && review.photoLinks.length > 0) && (
                                     <Badge variant="outline" className="gap-1 text-xs">
                                        <Camera className="h-3.5 w-3.5" />
                                        {review.photoLinks.length}
                                    </Badge>
                                  )}
                                  {review.video && (
                                      <Badge variant="outline" className="gap-1 text-xs">
                                        <Video className="h-3.5 w-3.5" />
                                    </Badge>
                                  )}
                                </div>
                                {review.pros && (
                                  <div className="flex items-start gap-2 text-sm text-green-700">
                                    <ThumbsUp className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>{review.pros}</span>
                                  </div>
                                )}
                                {review.cons && (
                                    <div className="flex items-start gap-2 text-sm text-red-700">
                                        <ThumbsDown className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{review.cons}</span>
                                    </div>
                                )}
                                {review.text && <p className="text-sm pt-1">{review.text}</p>}
                              </div>
                                {review.author && <Badge variant="outline">{review.author}</Badge>}
                            </div>
                            {hasAnswer && (
                                <Card className="mt-4 bg-muted/50">
                                    <CardContent className="p-3">
                                        <p className="text-xs font-semibold text-primary mb-1">Ответ продавца:</p>
                                        <p className="text-sm whitespace-pre-wrap">{review.answer?.text}</p>
                                    </CardContent>
                                </Card>
                            )}
                             <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 gap-4 flex-wrap">
                               <div className="flex items-center gap-4">
                                  {(feedbackComplaint || productComplaint) && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                          <div className="flex items-center text-orange-600 cursor-help">
                                              <ShieldAlert className="h-3 w-3 mr-1" />
                                              <span>Жалоба: {feedbackComplaint || productComplaint}</span>
                                          </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                            {feedbackComplaint && `На отзыв: ${feedbackComplaint}`}
                                            {feedbackComplaint && productComplaint && <br />}
                                            {productComplaint && `На товар: ${productComplaint}`}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {hasAnswer && (
                                    <div className="flex items-center text-green-600">
                                        <MessageSquareReply className="h-3 w-3 mr-1" />
                                        Есть ответ
                                    </div>
                                  )}
                               </div>
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {format(
                                  parseISO(review.date),
                                  "dd MMMM yyyy",
                                  { locale: ru }
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )})}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <p>Нет отзывов для отображения.</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
        </TooltipProvider>
        <SheetFooter className="p-4">
          <p className="text-xs text-muted-foreground">
            WB Reputation Manager
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
