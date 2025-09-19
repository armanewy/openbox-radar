-- Danger: deletes all inventory rows and resets id sequence
TRUNCATE TABLE inventory RESTART IDENTITY CASCADE;

