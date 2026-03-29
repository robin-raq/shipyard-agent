-- Migration to create notifications table

CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('assignment', 'comment', 'review_request', 'review_decision', 'mention', 'status_change')),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    entity_type VARCHAR(30),
    entity_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_entity_type ON notifications(entity_type);
CREATE INDEX idx_notifications_entity_id ON notifications(entity_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
