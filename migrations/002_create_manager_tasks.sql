-- Migration: Create manager_tasks table for Task Management Center
-- Date: 2026-01-19
-- Purpose: Centralized task tracking for managers across multiple stores

CREATE TABLE IF NOT EXISTS manager_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Task Details
  entity_type TEXT NOT NULL CHECK (entity_type IN ('review', 'chat', 'question')),
  entity_id TEXT NOT NULL, -- ID of the review/chat/question
  action TEXT NOT NULL CHECK (action IN ('generate_complaint', 'submit_complaint', 'check_complaint', 'reply_to_chat', 'reply_to_question')),

  -- Status & Priority
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  title TEXT NOT NULL, -- Human-readable task title
  description TEXT, -- Optional details
  notes TEXT, -- Manager's notes

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_manager_tasks_user_id ON manager_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_manager_tasks_store_id ON manager_tasks(store_id);
CREATE INDEX IF NOT EXISTS idx_manager_tasks_status ON manager_tasks(status);
CREATE INDEX IF NOT EXISTS idx_manager_tasks_entity ON manager_tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_manager_tasks_due_date ON manager_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_manager_tasks_created_at ON manager_tasks(created_at DESC);

-- Composite index for common queries (user + status)
CREATE INDEX IF NOT EXISTS idx_manager_tasks_user_status ON manager_tasks(user_id, status);

-- Ensure entity exists (referential integrity check via trigger)
-- Note: We can't use foreign keys here because entity_id references different tables
-- This trigger validates that the entity exists before creating a task
CREATE OR REPLACE FUNCTION validate_manager_task_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_type = 'review' THEN
    IF NOT EXISTS (SELECT 1 FROM reviews WHERE id = NEW.entity_id) THEN
      RAISE EXCEPTION 'Review with id % does not exist', NEW.entity_id;
    END IF;
  ELSIF NEW.entity_type = 'chat' THEN
    IF NOT EXISTS (SELECT 1 FROM chats WHERE id = NEW.entity_id) THEN
      RAISE EXCEPTION 'Chat with id % does not exist', NEW.entity_id;
    END IF;
  ELSIF NEW.entity_type = 'question' THEN
    IF NOT EXISTS (SELECT 1 FROM questions WHERE id = NEW.entity_id) THEN
      RAISE EXCEPTION 'Question with id % does not exist', NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_manager_task_entity
  BEFORE INSERT OR UPDATE ON manager_tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_manager_task_entity();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_manager_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_manager_tasks_updated_at
  BEFORE UPDATE ON manager_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_manager_tasks_updated_at();

-- Add comment to table
COMMENT ON TABLE manager_tasks IS 'Centralized task management for managers across multiple stores';
COMMENT ON COLUMN manager_tasks.entity_type IS 'Type of entity: review, chat, or question';
COMMENT ON COLUMN manager_tasks.entity_id IS 'ID of the entity (review_id, chat_id, or question_id)';
COMMENT ON COLUMN manager_tasks.action IS 'Action to perform: generate_complaint, submit_complaint, check_complaint, reply_to_chat, reply_to_question';
COMMENT ON COLUMN manager_tasks.status IS 'Task status: pending, in_progress, completed, cancelled';
COMMENT ON COLUMN manager_tasks.priority IS 'Task priority: low, normal, high, urgent';
