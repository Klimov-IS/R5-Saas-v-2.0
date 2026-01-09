import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook для автосохранения текста с debounce
 */
export function useAutoSave(
  storeId: string,
  delay: number = 2000
) {
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const saveReply = useCallback(async (reviewId: string, draftText: string) => {
    if (!draftText.trim()) return;

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
      await fetch(`/api/stores/${storeId}/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ draftReply: draftText })
      });
      console.log(`[AUTO-SAVE] Reply saved for review ${reviewId}`);
    } catch (error) {
      console.error('[AUTO-SAVE] Failed to save reply:', error);
    }
  }, [storeId]);

  const saveComplaint = useCallback(async (reviewId: string, complaintText: string) => {
    if (!complaintText.trim()) return;

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
      await fetch(`/api/stores/${storeId}/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ complaintText })
      });
      console.log(`[AUTO-SAVE] Complaint saved for review ${reviewId}`);
    } catch (error) {
      console.error('[AUTO-SAVE] Failed to save complaint:', error);
    }
  }, [storeId]);

  const scheduleReplyAutoSave = useCallback((reviewId: string, value: string) => {
    // Очистить предыдущий таймер
    if (timersRef.current[`reply_${reviewId}`]) {
      clearTimeout(timersRef.current[`reply_${reviewId}`]);
    }

    // Установить новый таймер
    timersRef.current[`reply_${reviewId}`] = setTimeout(() => {
      saveReply(reviewId, value);
    }, delay);
  }, [delay, saveReply]);

  const scheduleComplaintAutoSave = useCallback((reviewId: string, value: string) => {
    // Очистить предыдущий таймер
    if (timersRef.current[`complaint_${reviewId}`]) {
      clearTimeout(timersRef.current[`complaint_${reviewId}`]);
    }

    // Установить новый таймер
    timersRef.current[`complaint_${reviewId}`] = setTimeout(() => {
      saveComplaint(reviewId, value);
    }, delay);
  }, [delay, saveComplaint]);

  return {
    scheduleReplyAutoSave,
    scheduleComplaintAutoSave
  };
}
