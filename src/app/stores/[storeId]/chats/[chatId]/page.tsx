'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Send, Loader2, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useChatMessages, useGenerateAI, useSendMessage } from '@/hooks/useChats';

type ChatTag = 'deletion_candidate' | 'deletion_offered' | 'deletion_agreed' | 'deletion_confirmed';

const tagConfig: Record<string, { label: string; variant: any }> = {
  deletion_candidate: { label: 'Кандидат', variant: 'default' },
  deletion_offered: { label: 'Предложено', variant: 'secondary' },
  deletion_agreed: { label: 'Согласен', variant: 'outline' },
  deletion_confirmed: { label: 'Подтверждено', variant: 'secondary' },
};

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const storeId = params.storeId as string;
  const chatId = params.chatId as string;

  // ✅ React Query for data fetching (no more useState for chat/messages!)
  const { data, isLoading, refetch } = useChatMessages(storeId, chatId);
  const chat = data?.chat;
  const messages = data?.messages || [];

  const [newMessage, setNewMessage] = useState('');
  const [selectedTag, setSelectedTag] = useState<ChatTag | null>(null);
  const [isUpdatingTag, setIsUpdatingTag] = useState(false);

  const generateAI = useGenerateAI(storeId, chatId);
  const sendMessage = useSendMessage(storeId, chatId);

  // 🐛 DEBUG: Log when component renders
  console.log('🔄 [RENDER] Chat Detail Page:', {
    chatId,
    hasChatData: !!chat,
    chatDataId: chat?.id,
    clientName: chat?.clientName,
    hasDraftReply: !!chat?.draftReply,
    draftReplyLength: chat?.draftReply?.length || 0,
    draftPreview: chat?.draftReply?.substring(0, 50) || 'NULL',
    currentNewMessage: newMessage.substring(0, 50) || 'EMPTY',
    newMessageLength: newMessage.length,
  });

  // ✅ FIXED: Load draft from DB only when switching chats (VARIANT 3)
  // Key: dependency ONLY on chatId, not on chat.draftReply
  // This prevents conflicts between local edits and React Query updates
  useEffect(() => {
    console.log('🎯 [useEffect TRIGGERED] chatId dependency changed:', {
      chatId,
      hasChatData: !!chat,
      chatDataId: chat?.id,
      idsMatch: chat?.id === chatId,
      hasDraftReply: !!chat?.draftReply,
      draftReplyValue: chat?.draftReply?.substring(0, 100) || 'NULL',
      draftLength: chat?.draftReply?.length || 0,
      willSetTo: chat?.draftReply || '(empty string)',
    });

    setNewMessage(chat?.draftReply || '');

    console.log('✅ [useEffect COMPLETED] setNewMessage called with:', {
      value: chat?.draftReply?.substring(0, 100) || '(empty)',
      length: chat?.draftReply?.length || 0,
    });
  }, [chatId]);

  // Set initial tag when chat loads
  useEffect(() => {
    setSelectedTag(chat?.tag as ChatTag | null ?? null);
  }, [chat?.tag]);

  async function handleSendMessage() {
    if (!newMessage.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите текст сообщения',
        variant: 'destructive',
      });
      return;
    }

    try {
      await sendMessage.mutateAsync(newMessage);
      toast({
        title: 'Успешно',
        description: 'Сообщение отправлено в Wildberries',
      });
      setNewMessage('');
      // React Query automatically refetches
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отправить сообщение',
        variant: 'destructive',
      });
    }
  }

  async function handleUpdateTag(newTag: ChatTag) {
    try {
      setIsUpdatingTag(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag: newTag }),
      });

      if (response.ok) {
        setSelectedTag(newTag);
        toast({
          title: 'Успешно',
          description: 'Тег обновлён',
        });
        refetch(); // Refresh data
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось обновить тег',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при обновлении тега',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingTag(false);
    }
  }

  async function handleGenerateAI() {
    try {
      await generateAI.mutateAsync();
      toast({
        title: 'Успешно',
        description: 'AI ответ сгенерирован',
      });
      // React Query will auto-update the draft
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сгенерировать ответ',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-muted-foreground">Чат не найден</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
      </div>
    );
  }

  const currentTagConfig = selectedTag ? tagConfig[selectedTag] : { label: 'Без тега', variant: 'outline' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к списку
        </Button>
      </div>

      {/* Chat Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Чат с {chat.clientName}</CardTitle>
              <CardDescription>
                {chat.productName && `Товар: ${chat.productName}`}
                {chat.productVendorCode && ` (${chat.productVendorCode})`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedTag ?? undefined}
                onValueChange={(value) => handleUpdateTag(value as ChatTag)}
                disabled={isUpdatingTag}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deletion_candidate">Кандидат</SelectItem>
                  <SelectItem value="deletion_offered">Предложено</SelectItem>
                  <SelectItem value="deletion_agreed">Согласен</SelectItem>
                  <SelectItem value="deletion_confirmed">Подтверждено</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant={currentTagConfig.variant}>{currentTagConfig.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="my-4" />

          {/* Messages */}
          <div className="space-y-4">
            <h3 className="font-semibold">История сообщений:</h3>
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground">Нет сообщений</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-3 p-3 rounded-lg',
                        msg.sender === 'client' ? 'bg-muted' : 'bg-primary/10'
                      )}
                    >
                      <div className="flex-shrink-0">
                        {msg.sender === 'client' ? (
                          <User className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Bot className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">
                            {msg.sender === 'client' ? chat.clientName : 'Вы (продавец)'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.timestamp), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.text || '-'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator className="my-4" />

          {/* Send Message Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Отправить сообщение:</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAI}
                disabled={generateAI.isPending}
              >
                {generateAI.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Bot className="mr-2 h-3 w-3" />
                    Генерировать AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Введите ваше сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[100px]"
            />
            <Button
              onClick={handleSendMessage}
              disabled={sendMessage.isPending || !newMessage.trim()}
            >
              {sendMessage.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Отправить в WB
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
