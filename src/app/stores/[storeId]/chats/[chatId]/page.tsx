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

type ChatTag = 'active' | 'successful' | 'unsuccessful' | 'no_reply' | 'untagged';

type Chat = {
  id: string;
  store_id: string;
  client_name: string;
  product_nm_id: string | null;
  product_name: string | null;
  product_vendor_code: string | null;
  last_message_date: string | null;
  last_message_text: string | null;
  last_message_sender: 'client' | 'seller' | null;
  reply_sign: string;
  tag: ChatTag;
  draft_reply: string | null;
};

type ChatMessage = {
  id: string;
  chat_id: string;
  text: string | null;
  sender: 'client' | 'seller';
  timestamp: string;
};

const tagConfig: Record<ChatTag, { label: string; variant: any }> = {
  active: { label: 'Активный', variant: 'default' },
  successful: { label: 'Успешный', variant: 'secondary' },
  unsuccessful: { label: 'Неуспешный', variant: 'destructive' },
  no_reply: { label: 'Без ответа', variant: 'outline' },
  untagged: { label: 'Без тега', variant: 'outline' },
};

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const storeId = params.storeId as string;
  const chatId = params.chatId as string;

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedTag, setSelectedTag] = useState<ChatTag>('untagged');
  const [isUpdatingTag, setIsUpdatingTag] = useState(false);

  useEffect(() => {
    fetchChat();
  }, [storeId, chatId]);

  async function fetchChat() {
    try {
      setIsLoading(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (response.ok) {
        const result = await response.json();
        setChat(result.data.chat);
        setMessages(result.data.messages || []);
        setSelectedTag(result.data.chat.tag || 'untagged');
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить чат',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching chat:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при загрузке чата',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

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
      setIsSending(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: newMessage }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Сообщение отправлено в Wildberries',
        });
        setNewMessage('');
        // Refresh chat to get updated messages
        setTimeout(() => fetchChat(), 1000);
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось отправить сообщение',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при отправке сообщения',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handleUpdateTag(newTag: ChatTag) {
    try {
      setIsUpdatingTag(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

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
        fetchChat(); // Refresh data
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

  const currentTagConfig = tagConfig[selectedTag] || tagConfig.untagged;

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
              <CardTitle>Чат с {chat.client_name}</CardTitle>
              <CardDescription>
                {chat.product_name && `Товар: ${chat.product_name}`}
                {chat.product_vendor_code && ` (${chat.product_vendor_code})`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedTag}
                onValueChange={(value) => handleUpdateTag(value as ChatTag)}
                disabled={isUpdatingTag}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активный</SelectItem>
                  <SelectItem value="successful">Успешный</SelectItem>
                  <SelectItem value="unsuccessful">Неуспешный</SelectItem>
                  <SelectItem value="no_reply">Без ответа</SelectItem>
                  <SelectItem value="untagged">Без тега</SelectItem>
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
                            {msg.sender === 'client' ? chat.client_name : 'Вы (продавец)'}
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
            <h3 className="font-semibold">Отправить сообщение:</h3>
            <Textarea
              placeholder="Введите ваше сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[100px]"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isSending || !newMessage.trim()}
            >
              {isSending ? (
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
