import { useState, useCallback } from 'react';

export function useBulkActions(storeId: string) {
  const [bulkGeneratingReplies, setBulkGeneratingReplies] = useState(false);
  const [bulkGeneratingComplaints, setBulkGeneratingComplaints] = useState(false);
  const [bulkClearingDrafts, setBulkClearingDrafts] = useState(false);

  const handleBulkGenerateReplies = useCallback(async (
    selectedReviews: string[],
    onSuccess: () => void
  ) => {
    if (!confirm(`Сгенерировать ответы для ${selectedReviews.length} отзывов?`)) {
      return;
    }

    setBulkGeneratingReplies(true);

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const promises = selectedReviews.map(reviewId =>
        fetch(`/api/stores/${storeId}/reviews/${reviewId}/generate-reply`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      onSuccess();
      alert(`Готово! Успешно: ${succeeded}, ошибок: ${failed}`);
    } catch (error: any) {
      console.error('Bulk generate replies error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setBulkGeneratingReplies(false);
    }
  }, [storeId]);

  const handleBulkGenerateComplaints = useCallback(async (
    selectedReviews: string[],
    onSuccess: () => void
  ) => {
    if (!confirm(`Сгенерировать жалобы для ${selectedReviews.length} отзывов?`)) {
      return;
    }

    setBulkGeneratingComplaints(true);

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const promises = selectedReviews.map(reviewId =>
        fetch(`/api/stores/${storeId}/reviews/${reviewId}/generate-complaint`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      onSuccess();
      alert(`Готово! Успешно: ${succeeded}, ошибок: ${failed}`);
    } catch (error: any) {
      console.error('Bulk generate complaints error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setBulkGeneratingComplaints(false);
    }
  }, [storeId]);

  const handleBulkClearDrafts = useCallback(async (
    selectedReviews: string[],
    onSuccess: () => void
  ) => {
    if (!confirm(`Очистить черновики для ${selectedReviews.length} отзывов?`)) {
      return;
    }

    setBulkClearingDrafts(true);

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

      const promises = selectedReviews.map(reviewId =>
        fetch(`/api/stores/${storeId}/reviews/${reviewId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ draftReply: '', complaintText: '' })
        })
      );

      await Promise.all(promises);
      onSuccess();
      alert('Черновики очищены');
    } catch (error: any) {
      console.error('Bulk clear drafts error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setBulkClearingDrafts(false);
    }
  }, [storeId]);

  return {
    bulkGeneratingReplies,
    bulkGeneratingComplaints,
    bulkClearingDrafts,
    handleBulkGenerateReplies,
    handleBulkGenerateComplaints,
    handleBulkClearDrafts
  };
}
