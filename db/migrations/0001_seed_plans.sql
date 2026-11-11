-- Starting prices from the latest Instagram fee posts (DaSele4NOQt, DOsktn6jUc1).
-- Personal training price needs owner confirmation; change it in the admin portal later.
INSERT INTO "plans" ("name", "price", "period", "description", "features", "highlighted", "position") VALUES
  ('Registration', 1500, 'one_time', 'Paid once when you join.', '{}', false, 0),
  ('Strength', 2500, 'month', 'Full access to free weights and machines.', '{"Free weights and machines","Trainer on the floor"}', false, 1),
  ('Strength + cardio', 3500, 'month', 'Everything in Strength, plus treadmills and cardio.', '{"Free weights and machines","Treadmills and cardio","Trainer on the floor"}', true, 2),
  ('Personal training', 10000, 'month', 'One-to-one coaching with a certified trainer.', '{"Planned program","Form checks every set","Diet guidance"}', false, 3);
