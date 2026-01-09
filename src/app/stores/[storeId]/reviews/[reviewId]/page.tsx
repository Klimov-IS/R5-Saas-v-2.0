'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

type Review = {
  id: string;
  product_id: string;
  store_id: string;
  rating: number;
  text: string;
  pros: string | null;
  cons: string | null;
  author: string;
  date: string;
  answer: any | null;
  draft_reply: string | null;
  complaint_text: string | null;
  complaint_sent_date: string | null;
  wb_feedback_id: string;
};

export default function ReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const storeId = params.storeId as string;
  const reviewId = params.reviewId as string;

  const [review, setReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draftReply, setDraftReply] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchReview();
  }, [storeId, reviewId]);

  async function fetchReview() {
    try {
      setIsLoading(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const response = await fetch(`/api/stores/${storeId}/reviews/${reviewId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (response.ok) {
        const result = await response.json();
        setReview(result.data);
        setDraftReply(result.data.draft_reply || '');
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить отзыв',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching review:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при загрузке отзыва',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveDraft() {
    try {
      setIsSaving(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const response = await fetch(`/api/stores/${storeId}/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftReply }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Черновик сохранён',
        });
        fetchReview(); // Refresh data
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось сохранить черновик',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при сохранении',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendReply() {
    if (!draftReply.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите текст ответа',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSending(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const response = await fetch(`/api/stores/${storeId}/reviews/${reviewId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ replyText: draftReply }),
      });

      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Ответ отправлен в Wildberries',
        });
        fetchReview(); // Refresh data
      } else {
        const error = await response.json();
        toast({
          title: 'Ошибка',
          description: error.error || 'Не удалось отправить ответ',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при отправке ответа',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-muted-foreground">Отзыв не найден</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
      </div>
    );
  }

  const hasAnswer = review.answer && typeof review.answer === 'object' && review.answer.text;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к списку
        </Button>
      </div>

      {/* Review Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Отзыв от {review.author}</CardTitle>
              <CardDescription>
                {format(new Date(review.date), 'dd MMMM yyyy, HH:mm', { locale: ru })}
              </CardDescription>
            </div>
            <Badge variant={review.rating >= 4 ? 'default' : 'destructive'} className="text-lg px-3 py-1">
              {review.rating} ⭐
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Review Text */}
          <div>
            <h3 className="font-semibold mb-2">Текст отзыва:</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{review.text}</p>
          </div>

          {/* Pros */}
          {review.pros && (
            <div>
              <h3 className="font-semibold mb-2 text-green-600">Достоинства:</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{review.pros}</p>
            </div>
          )}

          {/* Cons */}
          {review.cons && (
            <div>
              <h3 className="font-semibold mb-2 text-red-600">Недостатки:</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{review.cons}</p>
            </div>
          )}

          <Separator />

          {/* Existing Answer */}
          {hasAnswer && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                Отправленный ответ
                <Badge variant="secondary">Отвечен</Badge>
              </h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{review.answer.text}</p>
              {review.answer.sentAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Отправлено: {format(new Date(review.answer.sentAt), 'dd.MM.yyyy HH:mm')}
                </p>
              )}
            </div>
          )}

          {/* Draft Reply Section */}
          {!hasAnswer && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Ваш ответ:</h3>
                <Textarea
                  placeholder="Введите ответ на отзыв..."
                  value={draftReply}
                  onChange={(e) => setDraftReply(e.target.value)}
                  className="min-h-[150px]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isSaving || isSending}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Сохранить черновик
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSendReply}
                  disabled={isSaving || isSending || !draftReply.trim()}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
