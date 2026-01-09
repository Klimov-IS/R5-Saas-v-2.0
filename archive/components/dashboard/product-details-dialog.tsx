
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import type { WithId, Product } from "@/lib/types";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Loader2, Save } from "lucide-react";
import { useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type ProductDetailsDialogProps = {
  product: WithId<Product> | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

type WbApiData = {
    title: string;
    description: string;
    photos: { big: string; }[];
    characteristics: { id: number; name: string; value: string; }[];
    vendorCode: string;
    nmID: number;
    sizes: { price: { basic: number; }; }[];
}

export function ProductDetailsDialog({
  product,
  isOpen,
  onOpenChange,
}: ProductDetailsDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [compensationMethod, setCompensationMethod] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setCompensationMethod(product.compensationMethod || '');
    }
  }, [product]);

  const handleSave = async () => {
    if (!product || !firestore) {
        toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось найти товар или подключение к базе.' });
        return;
    };
    
    setIsSaving(true);
    const productRef = doc(firestore, 'stores', product.storeId, 'products', product.id);
    try {
        await updateDoc(productRef, { compensationMethod: compensationMethod });
        toast({ title: 'Сохранено', description: 'Способ компенсации для товара обновлен.' });
        onOpenChange(false);
    } catch (error) {
        console.error('Failed to save compensation method:', error);
        toast({ variant: 'destructive', title: 'Ошибка сохранения', description: 'Не удалось обновить способ компенсации.' });
    } finally {
        setIsSaving(false);
    }
  };

  const wbData: WbApiData | null = product?.wbApiData ? JSON.parse(product.wbApiData) : null;
  const characteristics = wbData?.characteristics || [];
  const firstImage = wbData?.photos?.[0]?.big || product?.imageUrl;


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
          <DialogDescription>
            Артикул: {product?.vendorCode} / WB ID: {product?.wbProductId}
          </DialogDescription>
        </DialogHeader>
        {product && wbData ? (
          <>
          <ScrollArea className="max-h-[70vh]">
            <div className="p-1 pr-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {firstImage && (
                         <div className="p-1">
                            <Image
                                src={firstImage}
                                alt={`Фото ${product.name}`}
                                width={400}
                                height={533}
                                className="rounded-lg object-cover w-full mx-auto"
                            />
                        </div>
                    )}
               
                <div className="space-y-6">
                    <div>
                        <h3 className="font-semibold text-lg mb-2">Описание</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {wbData.description}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="compensationMethod" className="font-semibold text-lg">Способ компенсации</Label>
                        <Textarea 
                            id="compensationMethod"
                            value={compensationMethod}
                            onChange={(e) => setCompensationMethod(e.target.value)}
                            placeholder="Опишите, как обрабатывать возвраты или жалобы по этому товару..."
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">Этот текст будет использоваться ИИ для генерации ответов в чатах.</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg mb-2">Характеристики</h3>
                        <div className="space-y-2">
                            {characteristics.map((char) => (
                            <div
                                key={char.id}
                                className="flex justify-between text-sm p-2 rounded-md bg-muted/50"
                            >
                                <span className="text-muted-foreground">{char.name}</span>
                                <span className="font-medium text-right">{char.value}</span>
                            </div>
                            ))}
                        </div>
                    </div>
                </div>
                </div>
            </div>
          </ScrollArea>
           <DialogFooter className="pt-4">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Закрыть</Button>
                <Button onClick={handleSave} disabled={isSaving || compensationMethod === (product.compensationMethod || '')}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Сохранить
                </Button>
            </DialogFooter>
          </>
        ) : (
          <p>Нет данных для отображения.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
