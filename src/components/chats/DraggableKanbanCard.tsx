'use client';

import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import ChatKanbanCard from './ChatKanbanCard';
import type { ChatStatus, CompletionReason } from '@/db/helpers';

interface DraggableKanbanCardProps {
  id: string;
  clientName: string;
  productName?: string | null;
  lastMessageText?: string | null;
  lastMessageSender?: 'client' | 'seller' | null;
  lastMessageDate?: string | null;
  draftReply?: string | null;
  status: ChatStatus;
  messageCount?: number;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  completionReason?: CompletionReason | null;
  onChatClick?: (chatId: string) => void;
}

export default function DraggableKanbanCard(props: DraggableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: props.id });

  const didDragRef = useRef(false);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  // Track if a drag happened to distinguish click from drag
  if (isDragging) {
    didDragRef.current = true;
  }

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    props.onChatClick?.(props.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
    >
      <ChatKanbanCard {...props} />
    </div>
  );
}
