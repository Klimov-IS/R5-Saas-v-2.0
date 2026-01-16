'use client';

import { useState, useEffect } from 'react';
import { useGenerateAI, useSendMessage } from '@/hooks/useChats';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Send, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface MessageComposerProps {
  storeId: string;
  chatId: string;
}

export function MessageComposer({ storeId, chatId }: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [hasAIText, setHasAIText] = useState(false);

  const generateAI = useGenerateAI(storeId, chatId);
  const sendMessage = useSendMessage(storeId, chatId);

  const isGenerating = generateAI.isPending;
  const isSending = sendMessage.isPending;

  const handleGenerateAI = async () => {
    try {
      const result = await generateAI.mutateAsync();

      if (result.text) {
        setMessage(result.text);
        setHasAIText(true);
        toast.success('AI ответ сгенерирован');
      }
    } catch (error) {
      toast.error('Ошибка генерации AI ответа');
      console.error('Failed to generate AI response:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error('Сообщение не может быть пустым');
      return;
    }

    try {
      await sendMessage.mutateAsync(message);
      setMessage('');
      setHasAIText(false);
      toast.success('Сообщение отправлено в WB');
    } catch (error) {
      toast.error('Ошибка отправки сообщения');
      console.error('Failed to send message:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+G - Generate AI
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        handleGenerateAI();
      }

      // Enter (without Shift) - Send message
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        e.preventDefault();
        handleSendMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [message]);

  // Handle text change - update AI indicator
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (hasAIText && e.target.value !== message) {
      // User is editing AI text
    }
  };

  return (
    <div className="p-4 border-t border-slate-200 bg-white">
      {/* AI Mode Indicator */}
      {hasAIText && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
          <Bot className="w-4 h-4" />
          <span>
            AI режим активен — редактируйте текст или нажмите "Генерировать AI" ещё раз
          </span>
        </div>
      )}

      {/* Textarea */}
      <Textarea
        value={message}
        onChange={handleTextChange}
        placeholder="Напишите ваш ответ или нажмите 'Генерировать AI'..."
        className={`
          min-h-[100px] resize-y mb-3 transition-all
          ${hasAIText ? 'border-blue-300 bg-gradient-to-br from-white to-blue-50' : ''}
        `}
        disabled={isGenerating || isSending}
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAI}
            disabled={isGenerating || isSending}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bot className="w-4 h-4 mr-2" />
            )}
            Генерировать AI
          </Button>

          <span className="text-xs text-slate-400">
            или <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Ctrl+G</kbd>
          </span>
        </div>

        <Button
          size="sm"
          onClick={handleSendMessage}
          disabled={!message.trim() || isGenerating || isSending}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Отправить
          <span className="ml-2 text-xs opacity-80">
            <kbd className="px-1.5 py-0.5 bg-blue-400 rounded text-xs">Enter</kbd>
          </span>
        </Button>
      </div>
    </div>
  );
}
