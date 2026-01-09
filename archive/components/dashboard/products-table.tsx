'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Product, WithId } from '@/lib/types';
import { ChevronRight, Loader2, Save, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import { useFirestore } from '@/firebase';
import {
  doc,
  updateDoc,
  writeBatch,
  collection,
  getDocs,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { refreshReviewsForProduct } from '@/lib/server-actions/refresh-reviews';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';

type ProductsTableProps = {
  products: WithId<Product>[];
  onSelectProductForReviews: (product: WithId<Product>) => void;
  onSelectProductForDetails: (product: WithId<Product>) => void;
  storeId: string;
  selectedProductIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

export function ProductsTable({
  products,
  onSelectProductForReviews,
  onSelectProductForDetails,
  storeId,
  selectedProductIds,
  onSelectionChange,
}: ProductsTableProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [editingCompensation, setEditingCompensation] = useState<
    Record<string, string>
  >({});
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [isRefreshingProduct, startRefreshingProduct] = useTransition();
  const [refreshingProductId, setRefreshingProductId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const initialValues: Record<string, string> = {};
    products.forEach((p) => {
      initialValues[p.id] = p.compensationMethod || '';
    });
    setEditingCompensation(initialValues);
  }, [products]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(products.map((p) => p.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleRowSelect = (productId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedProductIds, productId]);
    } else {
      onSelectionChange(selectedProductIds.filter((id) => id !== productId));
    }
  };

  const handleStatusChange = async (
    product: WithId<Product>,
    isActive: boolean
  ) => {
    if (!firestore) return;
    const productRef = doc(firestore, 'stores', storeId, 'products', product.id);
    try {
      await updateDoc(productRef, { isActive });

      const reviewsRef = collection(
        firestore,
        `stores/${storeId}/products/${product.id}/reviews`
      );
      const reviewsSnapshot = await getDocs(reviewsRef);
      if (!reviewsSnapshot.empty) {
        const batch = writeBatch(firestore);
        reviewsSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, { isProductActive: isActive });
        });
        await batch.commit();
      }

      toast({
        title: 'Статус обновлен',
        description: `Товар "${product.name}" теперь ${
          isActive ? 'активен' : 'неактивен'
        }. Статус отзывов также обновлен.`,
      });
    } catch (error) {
      console.error('Failed to update product status:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось обновить статус товара.',
      });
    }
  };

  const handleSaveCompensation = async (productId: string) => {
    if (!firestore) return;
    const newCompensation = editingCompensation[productId];

    setSavingStates((prev) => ({ ...prev, [productId]: true }));

    const productRef = doc(firestore, 'stores', storeId, 'products', productId);
    try {
      await updateDoc(productRef, { compensationMethod: newCompensation });
      toast({
        title: 'Способ компенсации сохранен',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
      });
    } finally {
      setSavingStates((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleRefreshSingleProduct = (product: WithId<Product>) => {
    setRefreshingProductId(product.id);
    startRefreshingProduct(async () => {
      try {
        const result = await refreshReviewsForProduct(storeId, product.wbProductId);
        toast({
          title: 'Отзывы обновлены',
          description: result.message,
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Ошибка обновления отзывов',
          description: error.message,
        });
      } finally {
        setRefreshingProductId(null);
      }
    });
  };

  const isAllOnPageSelected = useMemo(() => {
    if (products.length === 0) return false;
    return products.every((p) => selectedProductIds.includes(p.id));
  }, [products, selectedProductIds]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Товары магазина ({products.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllOnPageSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Выбрать все на странице"
                  />
                </TableHead>
                <TableHead className="w-[80px]">Изображение</TableHead>
                <TableHead>Название/Артикул</TableHead>
                <TableHead className="text-center">WB ID</TableHead>
                <TableHead className="text-center">Отзывы</TableHead>
                <TableHead className="w-[350px]">Способ компенсации</TableHead>
                <TableHead className="text-center">Активный</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length > 0 ? (
                products.map((product) => {
                  const isSaving = savingStates[product.id];
                  const isChanged =
                    editingCompensation[product.id] !==
                    (product.compensationMethod || '');
                  const isCurrentProductRefreshing = refreshingProductId === product.id;

                  return (
                    <TableRow
                      key={product.id}
                      data-state={
                        selectedProductIds.includes(product.id)
                          ? 'selected'
                          : ''
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedProductIds.includes(product.id)}
                          onCheckedChange={(checked) =>
                            handleRowSelect(product.id, !!checked)
                          }
                          aria-label={`Выбрать ${product.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            width={60}
                            height={80}
                            className="rounded-md object-cover"
                          />
                        ) : (
                          <div className="w-[60px] h-[80px] bg-muted rounded-md" />
                        )}
                      </TableCell>
                      <TableCell
                        className="font-medium cursor-pointer hover:bg-muted/50"
                        onClick={() => onSelectProductForDetails(product)}
                      >
                        <div>{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.vendorCode}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{product.wbProductId}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{product.reviewCount || 0}</Badge>
                      </TableCell>
                      <TableCell className="min-w-[250px]">
                        <div className="flex items-start gap-2">
                          <Textarea
                            value={editingCompensation[product.id] || ''}
                            onChange={(e) =>
                              setEditingCompensation((prev) => ({
                                ...prev,
                                [product.id]: e.target.value,
                              }))
                            }
                            placeholder="Опишите способ компенсации..."
                            rows={2}
                            className="text-xs"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSaveCompensation(product.id)}
                            disabled={isSaving || !isChanged}
                            className="shrink-0"
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={product.isActive ?? false}
                          onCheckedChange={(checked) =>
                            handleStatusChange(product, checked)
                          }
                          aria-label="Статус активности товара"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className='flex items-center justify-end gap-1'>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRefreshSingleProduct(product)}
                                disabled={isCurrentProductRefreshing || isRefreshingProduct}
                              >
                                <RefreshCw className={isCurrentProductRefreshing ? 'animate-spin h-4 w-4' : 'h-4 w-4'} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Обновить отзывы для этого товара</p>
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectProductForReviews(product)}
                          disabled={(product.reviewCount || 0) === 0}
                        >
                          Отзывы
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    Нет товаров для отображения. Обновите список товаров или
                    измените фильтры.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
