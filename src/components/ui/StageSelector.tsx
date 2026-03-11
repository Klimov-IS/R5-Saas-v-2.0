import { type StoreStage, STORE_STAGE_LABELS } from '@/types/stores';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Ordered list of all store lifecycle stages
 * Sprint 006 Phase 3
 */
const STAGES: StoreStage[] = [
  'contract',
  'access_received',
  'cabinet_connected',
  'complaints_submitted',
  'chats_opened',
  'monitoring',
  'client_paused',
  'client_lost',
];

interface StageSelectorProps {
  value: StoreStage;
  onChange: (stage: StoreStage) => void;
  disabled?: boolean;
}

/**
 * Dropdown selector for store lifecycle stage
 *
 * Usage:
 *   <StageSelector
 *     value={store.stage}
 *     onChange={(stage) => handleStageChange(store.id, stage)}
 *   />
 */
export function StageSelector({ value, onChange, disabled }: StageSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((stage) => (
          <SelectItem key={stage} value={stage}>
            {STORE_STAGE_LABELS[stage]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
