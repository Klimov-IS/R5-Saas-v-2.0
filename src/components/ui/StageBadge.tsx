import { StoreStage, STORE_STAGE_LABELS } from '@/db/helpers';
import { Badge } from '@/components/ui/badge';

/**
 * Color scheme for store lifecycle stages
 * Sprint 006 Phase 3
 */
const STAGE_COLORS: Record<StoreStage, string> = {
  contract: 'bg-blue-100 text-blue-700 border-blue-300',
  access_received: 'bg-purple-100 text-purple-700 border-purple-300',
  cabinet_connected: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  complaints_submitted: 'bg-orange-100 text-orange-700 border-orange-300',
  chats_opened: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  monitoring: 'bg-green-100 text-green-700 border-green-300',
  client_paused: 'bg-gray-100 text-gray-700 border-gray-300',
  client_lost: 'bg-red-100 text-red-700 border-red-300',
};

/**
 * Emoji icons for store lifecycle stages
 */
const STAGE_EMOJI: Record<StoreStage, string> = {
  contract: '📄',
  access_received: '🔑',
  cabinet_connected: '✅',
  complaints_submitted: '📋',
  chats_opened: '💬',
  monitoring: '🟢',
  client_paused: '⏸️',
  client_lost: '🔴',
};

interface StageBadgeProps {
  stage: StoreStage;
  showEmoji?: boolean;
}

/**
 * Visual badge component for displaying store lifecycle stage
 *
 * Usage:
 *   <StageBadge stage="monitoring" />
 *   <StageBadge stage="contract" showEmoji={false} />
 */
export function StageBadge({ stage, showEmoji = true }: StageBadgeProps) {
  return (
    <Badge className={STAGE_COLORS[stage]} variant="outline">
      {showEmoji && <span className="mr-1">{STAGE_EMOJI[stage]}</span>}
      {STORE_STAGE_LABELS[stage]}
    </Badge>
  );
}
