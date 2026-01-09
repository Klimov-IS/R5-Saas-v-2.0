
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { WithId, Store } from "@/lib/types";
import { useEffect, useState } from "react";
import { ScrollArea } from "../ui/scroll-area";

const editStoreSchema = z.object({
  name: z.string().min(1, "Название магазина обязательно"),
  apiToken: z.string().min(1, "Универсальный токен WB API обязателен"),
  contentApiToken: z.string().optional(),
  feedbacksApiToken: z.string().optional(),
  chatApiToken: z.string().optional(),
});

type EditStoreForm = z.infer<typeof editStoreSchema>;

type EditStoreDialogProps = {
  store: WithId<Store> | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditStoreDialog({ store, isOpen, onOpenChange }: EditStoreDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditStoreForm>({
    resolver: zodResolver(editStoreSchema),
    defaultValues: { name: "", apiToken: "", contentApiToken: "", feedbacksApiToken: "", chatApiToken: "" },
  });

  useEffect(() => {
    if (store) {
      form.reset({
        name: store.name,
        apiToken: store.apiToken,
        contentApiToken: store.contentApiToken || "",
        feedbacksApiToken: store.feedbacksApiToken || "",
        chatApiToken: store.chatApiToken || "",
      });
    }
  }, [store, form]);


  async function onSubmit(data: EditStoreForm) {
    if (!store) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось определить магазин для обновления.",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const payload = {
        name: data.name,
        apiToken: data.apiToken,
        contentApiToken: data.contentApiToken || undefined,
        feedbacksApiToken: data.feedbacksApiToken || undefined,
        chatApiToken: data.chatApiToken || undefined,
      };

      const response = await fetch(`/api/stores/${store.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update store');
      }

      toast({
        title: "Магазин обновлен!",
        description: `Данные магазина "${data.name}" успешно обновлены.`,
      });

      onOpenChange(false);

      // Refresh the page to show updated data
      window.location.reload();

    } catch (error: any) {
      console.error('Error updating store:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось обновить магазин.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Редактировать магазин</DialogTitle>
          <DialogDescription>
            Измените название или API токен вашего WB магазина.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
             <ScrollArea className="max-h-[70vh] p-1">
                <div className="space-y-4 pr-5">
                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Название магазина</FormLabel>
                        <FormControl>
                            <Input placeholder="Например, 'Мой лучший магазин'" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="apiToken"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Универсальный токен WB API (x64)</FormLabel>
                        <FormControl>
                            <Input
                            type="password"
                            placeholder="Обязательное поле"
                            {...field}
                            />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Используется, если специфичные токены ниже не указаны.</p>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <p className="text-sm text-muted-foreground pt-4">Опционально: отдельные токены</p>
                    <FormField
                    control={form.control}
                    name="contentApiToken"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Токен API контента</FormLabel>
                        <FormControl>
                            <Input
                            type="password"
                            placeholder="Оставьте пустым, чтобы использовать универсальный"
                            {...field}
                            />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Ключ для работы с товарами.</p>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="feedbacksApiToken"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Токен API отзывов и вопросов</FormLabel>
                        <FormControl>
                            <Input
                            type="password"
                            placeholder="Оставьте пустым, чтобы использовать универсальный"
                            {...field}
                            />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Ключ для работы с отзывами и вопросами.</p>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="chatApiToken"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Токен API чатов</FormLabel>
                        <FormControl>
                            <Input
                            type="password"
                            placeholder="Оставьте пустым, чтобы использовать универсальный"
                            {...field}
                            />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Ключ для работы с чатами с покупателями.</p>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
            </ScrollArea>
            <DialogFooter className="pt-6 pr-5">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Сохранить
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
