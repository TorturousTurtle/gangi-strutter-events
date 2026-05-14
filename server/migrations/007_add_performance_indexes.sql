-- Migration 007: Add performance indexes
-- Optimizes common query patterns for the registration system

-- Index on registrations.competition_id for filtering by competition
CREATE INDEX IF NOT EXISTS idx_registrations_competition_id
    ON registrations(competition_id);

-- Index on registrations.created_at for date-based sorting
CREATE INDEX IF NOT EXISTS idx_registrations_created_at
    ON registrations(created_at);

-- Composite index for the most common admin-list query pattern
-- (filter by competition, sort by created_at descending)
CREATE INDEX IF NOT EXISTS idx_registrations_comp_created
    ON registrations(competition_id, created_at DESC);

-- Index on coaches.is_active for filtering active coaches
CREATE INDEX IF NOT EXISTS idx_coaches_is_active
    ON coaches(is_active);

-- Index on competitions.is_current for finding the current competition
CREATE INDEX IF NOT EXISTS idx_competitions_is_current
    ON competitions(is_current);

-- Index on competition_coaches for the join query in registration form
CREATE INDEX IF NOT EXISTS idx_competition_coaches_comp_id
    ON competition_coaches(competition_id);

-- Index on event_options.is_active for filtering active options
CREATE INDEX IF NOT EXISTS idx_event_options_is_active
    ON event_options(is_active);
