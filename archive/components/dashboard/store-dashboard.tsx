

'use client';

import { useTransition, useState, useMemo, useEffect } from "react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where, writeBatch, updateDoc, getDoc, getCountFromServer, collectionGroup } from "firebase/firestore";
import type { Product, Store, WithId, UpdateStatus, ChatTag } from "@/lib/types";
import { StatsCards } from "../dashboard/stats-cards";
import { ProductsTable } from "../dashboard/products-table";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryState } from "@/hooks/use-query-state";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';


type StoreDashboardProps = {
  store: WithId<Store>;
  onSelectProductForReviews: (product: WithId<Product>) => void;
  onSelectProductForDetails: (product: WithId<Product>) => void;
};

const UpdateStatusBadge = ({ status, date, type }: { status?: UpdateStatus, date?: string, type: 'товаров' }) => {
  if (!status || status === "idle") return null;

  const iconMap = {
    pending: <RefreshCw className="h-3 w-3 animate-spin" />,
    success: <CheckCircle className="h-3 w-3 text-green-500" />,
    error: <AlertCircle className="h-3 w-3 text-red-500" />,
  };

  const textMap = {
    pending: `Обновление ${type}...`,
    success: `Обновлено`,
    error: `Ошибка`,
  };
  
  let timeAgo = '';
  if (date) {
    try {
        timeAgo = formatDistanceToNow(new Date(date), { addSuffix: true, locale: ru });
    } catch (e) {
        timeAgo = 'недавно';
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {iconMap[status]}
      <span>{textMap[status]} {timeAgo}</span>
    </div>
  );
};


export function StoreDashboard({ store, onSelectProductForReviews, onSelectProductForDetails }: StoreDashboardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isProductsRefreshing, startProductsRefreshing] = useTransition();
  const [isRecalculating, startRecalculating] = useTransition();
  const { toast } = useToast();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useQueryState('q', '');
  const [onlyActive, setOnlyActive] = useQueryState('active', true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);


  const storeRef = useMemoFirebase(() => (firestore && store.id ? doc(firestore, "stores", store.id) : null), [firestore, store.id]);
  const {data: liveStore, isLoading: isLoadingStore } = useDoc<WithId<Store>>(storeRef);

  const productsQuery = useMemoFirebase(
    () => {
      if (firestore && store.id) {
        return query(collection(firestore, "stores", store.id, "products"));
      }
      return null;
    },
    [firestore, store.id]
  );

  const { data: products, isLoading: isLoadingProducts } = useCollection<WithId<Product>>(productsQuery);
  
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams.toString());
    const updateParam = (key: string, value: any, defaultValue: any) => {
        const isDefault = String(value) === String(defaultValue);
        if (isDefault) {
            newParams.delete(key);
        } else {
            newParams.set(key, String(value));
        }
    };

    updateParam('q', searchTerm, '');
    updateParam('active', onlyActive, true);
    
    const finalUrl = `${pathname}?${newParams.toString()}`;
    if (typeof window !== 'undefined' && window.location.href !== `${window.location.origin}${finalUrl}`) {
        router.replace(finalUrl, { scroll: false });
    }
  }, [searchTerm, onlyActive, pathname, router, searchParams]);
  

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(product => {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = searchTerm.length < 2 ||
        product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        product.vendorCode.toLowerCase().includes(lowerCaseSearchTerm) ||
        product.wbProductId.includes(searchTerm);
      
      const matchesActive = !onlyActive || product.isActive;

      return matchesSearch && matchesActive;
    })
  }, [products, searchTerm, onlyActive]);
  
  const handleRecalculateStats = (productIdsToProcess?: string[]) => {
    
    const productsToRecalculate = productIdsToProcess 
        ? products?.filter(p => productIdsToProcess.includes(p.id)) 
        : products;

    if (!firestore || !productsToRecalculate || productsToRecalculate.length === 0) {
        toast({ variant: "destructive", title: "Нет товаров для обработки" });
        return;
    }
    
    startRecalculating(async () => {
        toast({ title: "Пересчет статистики", description: `Начинаем пересчет для ${productsToRecalculate.length} товаров...` });
        const BATCH_SIZE = 100;
        let processedCount = 0;
        let totalReviewsCountForStore = 0;

        try {
            for (let i = 0; i < productsToRecalculate.length; i += BATCH_SIZE) {
                const batch = writeBatch(firestore);
                const chunk = productsToRecalculate.slice(i, i + BATCH_SIZE);
                
                const counts = await Promise.all(chunk.map(async (product) => {
                    const reviewsRef = collection(firestore, 'stores', store.id, 'products', product.id, 'reviews');
                    const snapshot = await getCountFromServer(reviewsRef);
                    return { productId: product.id, count: snapshot.data().count };
                }));

                for (const { productId, count } of counts) {
                    const productRef = doc(firestore, 'stores', store.id, 'products', productId);
                    batch.update(productRef, { reviewCount: count });
                    totalReviewsCountForStore += count;
                }

                await batch.commit();
                processedCount += chunk.length;
                toast({ description: `Обработано ${processedCount} из ${productsToRecalculate.length} товаров.` });
                await new Promise(res => setTimeout(res, 1000));
            }
            
            // If we processed all products, we can update the store's total count.
            if (!productIdsToProcess) {
                const totalChatsSnap = await getCountFromServer(collection(firestore, `stores/${store.id}/chats`));
                await updateDoc(storeRef!, {
                    totalReviews: totalReviewsCountForStore,
                    totalChats: totalChatsSnap.data().count,
                });
            } else {
                // If only some products were processed, we need to do a full recount for the store
                const allReviewsInStore = await getCountFromServer(query(collectionGroup(firestore, 'reviews'), where('storeId', '==', store.id)));
                 await updateDoc(storeRef!, {
                    totalReviews: allReviewsInStore.data().count
                });
            }

            toast({ title: "Успех!", description: "Количество отзывов успешно обновлено." });
            setSelectedProductIds([]); // Clear selection after processing

        } catch (error: any) {
            console.error("Failed to recalculate review counts:", error);
            toast({ variant: "destructive", title: "Ошибка пересчета", description: error.message });
        }
    });
  };

  const handleRefreshProducts = () => {
    if (!user || !liveStore || !firestore) return;

    const currentStore = liveStore;

    startProductsRefreshing(async () => {
      const storeRef = doc(firestore, 'stores', currentStore.id);

      const updateStoreStatus = (status: UpdateStatus, error?: string) => {
        const payload: any = {
          lastProductUpdateStatus: status,
          lastProductUpdateDate: new Date().toISOString(),
        };
        if (error) payload.lastProductUpdateError = error;
        
        updateDoc(storeRef, payload).catch(updateError => {
            const permissionError = new FirestorePermissionError({
              path: storeRef.path,
              operation: 'update',
              requestResourceData: payload,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
      };

      toast({ title: "Обновление товаров", description: "Запущен процесс обновления товаров..." });
      updateStoreStatus('pending');

      try {
        let allCards: any[] = [];
        let cursor: any = { limit: 100 };
        let total = 0;

        while (true) {
          const response = await fetch('/api/wb-proxy/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ storeId: currentStore.id, cursor })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || `Ошибка прокси-сервера: ${response.status}`);
          }

          const productData = await response.json();
          const cards = productData.cards || [];
          allCards = allCards.concat(cards);
          total = productData.cursor.total;

          if (total < cursor.limit || cards.length === 0) break;

          cursor = {
            ...cursor,
            updatedAt: productData.cursor.updatedAt,
            nmID: productData.cursor.nmID,
          };
        }

        const newProductIds = new Set<string>();

        if (allCards.length > 0) {
          const BATCH_SIZE = 100;
          const existingProductIds = new Set(products?.map(p => p.id) || []);

          for (let i = 0; i < allCards.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = allCards.slice(i, i + BATCH_SIZE);

            for (const card of chunk) {
              const nmId = card.nmID.toString();
              const productRef = doc(firestore, 'stores', currentStore.id, 'products', nmId);

              if (!existingProductIds.has(nmId)) {
                newProductIds.add(nmId); // This is a new product
              }
              
              const priceInfo = card.sizes?.find((s: any) => s.price?.basic)?.price;
              const price = priceInfo ? priceInfo.basic / 100 : 0;
              const imageUrl = card.photos?.[0]?.big;

              batch.set(productRef, {
                id: nmId,
                name: card.title || 'Без названия',
                wbProductId: nmId,
                vendorCode: card.vendorCode,
                price: price,
                ...(imageUrl && { imageUrl: imageUrl }),
                wbApiData: JSON.stringify(card),
                ownerId: user.uid,
                storeId: currentStore.id,
              }, { merge: true }); // Use merge to avoid overwriting isActive
            }
            await batch.commit();
            await new Promise(res => setTimeout(res, 1000));
          }
        }
        
        updateStoreStatus('success');
        toast({ title: "Успех!", description: `Найдено и обновлено ${allCards.length} товаров. Запускаем пересчет отзывов...` });

        // Recalculate counts only for new products
        if (newProductIds.size > 0) {
            (async () => {
                toast({ title: "Фоновая задача", description: `Начинаем пересчет количества отзывов для ${newProductIds.size} новых товаров.` });
                const BATCH_SIZE = 100;
                const newProductsArray = Array.from(newProductIds);

                for (let i = 0; i < newProductsArray.length; i += BATCH_SIZE) {
                    const batch = writeBatch(firestore);
                    const chunk = newProductsArray.slice(i, i + BATCH_SIZE);
                    const counts = await Promise.all(chunk.map(async (productId) => {
                        const reviewsRef = collection(firestore, 'stores', currentStore.id, 'products', productId, 'reviews');
                        const snapshot = await getCountFromServer(reviewsRef);
                        return { productId, count: snapshot.data().count };
                    }));

                    for (const { productId, count } of counts) {
                        const productRef = doc(firestore, 'stores', currentStore.id, 'products', productId);
                        batch.update(productRef, { reviewCount: count });
                    }

                    await batch.commit();
                    toast({ description: `Пересчет отзывов: обработано ${Math.min(i + BATCH_SIZE, newProductsArray.length)} из ${newProductsArray.length} новых товаров.` });
                    await new Promise(res => setTimeout(res, 1000));
                }
                toast({ title: "Пересчет завершен", description: "Количество отзывов для новых товаров было успешно обновлено." });
                 // Finally, trigger a full store stat recount
                handleRecalculateStats();
            })();
        } else {
             toast({ description: "Новых товаров не найдено, пересчет отзывов не требуется." });
        }


      } catch (error: any) {
        console.error("[CLIENT-SIDE ERROR] refreshProductsFromWb failed:", error);
        const errorMessage = error.message || "Не удалось обновить товары.";
        updateStoreStatus('error', errorMessage);
        toast({ variant: "destructive", title: "Ошибка обновления", description: errorMessage });
      }
    });
  };
  

  const currentStoreData = liveStore || store;
  const isRefreshing = isProductsRefreshing || isRecalculating;
  const isLoading = isLoadingProducts || isLoadingStore;
  
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Дашборд</h2>
        <div className="flex flex-col items-end gap-2">
           <div className="flex items-center gap-4">
            <UpdateStatusBadge status={currentStoreData.lastProductUpdateStatus} date={currentStoreData.lastProductUpdateDate} type="товаров"/>
            <div className="flex items-center gap-2">
              <Button onClick={() => handleRecalculateStats()} disabled={isRefreshing || isLoading || !products || products.length === 0} variant="outline">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRecalculating && selectedProductIds.length === 0 ? 'animate-spin' : ''}`} />
                  Пересчитать статистику
              </Button>
               {selectedProductIds.length > 0 && (
                <Button onClick={() => handleRecalculateStats(selectedProductIds)} disabled={isRefreshing || isLoading} variant="secondary">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRecalculating && selectedProductIds.length > 0 ? 'animate-spin' : ''}`} />
                  Пересчитать для {selectedProductIds.length} выбранных
                </Button>
              )}
            </div>
            <Button onClick={handleRefreshProducts} disabled={isRefreshing || isLoadingStore}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isProductsRefreshing ? 'animate-spin' : ''}`} />
                Обновить товары
            </Button>
           </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-96" />
        </div>
      ) : (
        <>
            <StatsCards products={products || []} store={currentStoreData} />

            <Card className="mt-8">
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Поиск по названию, артикулу или WB ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full md:w-80"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="active-only-switch"
                      checked={onlyActive}
                      onCheckedChange={setOnlyActive}
                    />
                    <Label htmlFor="active-only-switch">Только активные</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <ProductsTable 
                products={filteredProducts || []}
                onSelectProductForDetails={onSelectProductForDetails}
                onSelectProductForReviews={onSelectProductForReviews}
                storeId={store.id}
                selectedProductIds={selectedProductIds}
                onSelectionChange={setSelectedProductIds}
            />
        </>
      )}
    </div>
  );
}
