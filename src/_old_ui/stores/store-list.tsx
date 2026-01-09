"use client";

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store as StoreIcon, ChevronRight, MoreVertical, RefreshCw, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApiActions } from "@/hooks/use-api-actions";
import { EditStoreDialog } from './edit-store-dialog';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Store as StoreType } from '@/lib/types';

type ChatTag = 'untagged' | 'active' | 'successful' | 'unsuccessful' | 'no_reply';

type Store = {
  id: string;
  name: string;
  total_reviews?: number;
  total_chats?: number;
  chat_tag_counts?: Record<string, number>;
};

const tagConfig: Record<ChatTag, { label: string; bgColor: string, textColor: string }> = {
    untagged: { label: "Без тега", bgColor: "#94A3B8", textColor: "#ffffff" },
    active: { label: "Активный", bgColor: "#3b82f6", textColor: "#ffffff" },
    successful: { label: "Успешный", bgColor: "#22c55e", textColor: "#ffffff" },
    unsuccessful: { label: "Неуспешный", bgColor: "#ef4444", textColor: "#ffffff" },
    no_reply: { label: "Без ответа", bgColor: "#f59e0b", textColor: "#ffffff" },
};

type StoreListProps = {
  stores: Store[];
};

export function StoreList({ stores }: StoreListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { triggerUpdate, isUpdating } = useApiActions();
  const [editStore, setEditStore] = useState<WithId<StoreType> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNavigate = (storeId: string) => {
    router.push(`/stores/${storeId}`);
  };

  const handleEdit = (store: Store) => {
    setEditStore({
      id: store.id,
      name: store.name,
      apiToken: '',
      contentApiToken: '',
      feedbacksApiToken: '',
      chatApiToken: '',
    } as WithId<StoreType>);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (storeId: string) => {
    try {
      setIsDeleting(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const response = await fetch(`/api/stores/${storeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete store');
      }

      toast({
        title: "Магазин удалён!",
        description: "Магазин успешно удалён из системы.",
      });

      // Refresh the page to show updated list
      window.location.reload();

    } catch (error: any) {
      console.error('Error deleting store:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось удалить магазин.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteStoreId(null);
    }
  };

  if (stores.length === 0) {
    return (
      <div className="text-center py-16">
        <StoreIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold">У вас пока нет магазинов</h3>
        <p className="text-muted-foreground mt-2">
          Нажмите "Добавить магазин", чтобы начать.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100 hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Название магазина
              </TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Отзывы
              </TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Диалоги
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Статистика диалогов
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Действия
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map((store) => {
              const { total_reviews = 0, total_chats = 0, chat_tag_counts = {} } = store;
              const sortedTags = Object.entries(chat_tag_counts).sort(([a], [b]) => {
                  const order = ['active', 'no_reply', 'unsuccessful', 'successful', 'untagged'];
                  return order.indexOf(a) - order.indexOf(b);
              });

              const isUpdatingDialogues = isUpdating(store.id, 'dialogues');
              const isUpdatingReviews = isUpdating(store.id, 'reviews');
              const anyUpdateInProgress = isUpdatingDialogues || isUpdatingReviews;

              return (
                <TableRow
                  key={store.id}
                  className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => handleNavigate(store.id)}
                >
                  <TableCell className="py-5 font-semibold text-foreground">
                    {store.name}
                  </TableCell>
                  <TableCell className="py-5 text-center font-medium text-foreground">
                    {total_reviews}
                  </TableCell>
                  <TableCell className="py-5 text-center font-medium text-foreground">
                    {total_chats}
                  </TableCell>
                  <TableCell className="py-5">
                     <div className="flex flex-wrap gap-1.5">
                          {sortedTags.map(([tag, count]) => {
                              if (count === 0) return null;
                              const config = tagConfig[tag as ChatTag] || tagConfig.untagged;
                              return (
                                  <Tooltip key={tag} delayDuration={100}>
                                      <TooltipTrigger>
                                          <Badge
                                              className="text-xs px-3 py-1 font-semibold border-0 shadow-sm hover:shadow transition-shadow cursor-help"
                                              style={{
                                                  backgroundColor: config.bgColor,
                                                  color: config.textColor
                                              }}
                                          >
                                              {count}
                                          </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>{config.label}</p>
                                      </TooltipContent>
                                  </Tooltip>
                              );
                          })}
                      </div>
                  </TableCell>
                  <TableCell className="py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="font-semibold shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigate(store.id);
                            }}
                          >
                              Перейти
                              <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Открыть меню</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); triggerUpdate(store.id, 'reviews'); }}
                                disabled={anyUpdateInProgress}
                              >
                                <RefreshCw className={cn("mr-2 h-4 w-4", isUpdatingReviews && "animate-spin")} />
                                Обновить отзывы
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); triggerUpdate(store.id, 'dialogues'); }}
                                disabled={anyUpdateInProgress}
                              >
                                <MessageSquare className={cn("mr-2 h-4 w-4", isUpdatingDialogues && "animate-spin")} />
                                Обновить диалоги
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(store); }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setDeleteStoreId(store.id); }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <EditStoreDialog
        store={editStore}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <AlertDialog open={!!deleteStoreId} onOpenChange={(open) => !open && setDeleteStoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Магазин и все связанные с ним данные будут удалены навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteStoreId && handleDelete(deleteStoreId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
