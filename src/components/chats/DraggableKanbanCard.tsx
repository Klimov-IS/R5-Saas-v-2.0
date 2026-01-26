'use client';

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
}

export default function DraggableKanbanCard(props: DraggableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: props.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ChatKanbanCard {...props} />
    </div>
  );
}
