-- Default (system) categories: user_id is null so every user sees them,
-- and users can still add their own custom categories alongside these.

insert into public.categories (name, kind, icon, color, is_needs_wants) values
  ('Salary', 'income', 'briefcase', '#22c55e', null),
  ('Freelance', 'income', 'laptop', '#22c55e', null),
  ('Interest & Dividends', 'income', 'trending-up', '#22c55e', null),
  ('Other Income', 'income', 'plus-circle', '#22c55e', null),

  ('Housing & Rent', 'expense', 'home', '#f97316', 'needs'),
  ('Groceries', 'expense', 'shopping-cart', '#f97316', 'needs'),
  ('Utilities', 'expense', 'zap', '#f97316', 'needs'),
  ('Transportation', 'expense', 'car', '#f97316', 'needs'),
  ('Healthcare', 'expense', 'heart-pulse', '#f97316', 'needs'),
  ('Insurance', 'expense', 'shield', '#f97316', 'needs'),
  ('Dining Out', 'expense', 'utensils', '#eab308', 'wants'),
  ('Entertainment', 'expense', 'film', '#eab308', 'wants'),
  ('Shopping', 'expense', 'shopping-bag', '#eab308', 'wants'),
  ('Travel', 'expense', 'plane', '#eab308', 'wants'),
  ('Subscriptions', 'expense', 'repeat', '#eab308', 'wants'),
  ('Education', 'expense', 'graduation-cap', '#f97316', 'needs'),
  ('Fees & Charges', 'expense', 'receipt', '#f97316', 'needs'),
  ('Miscellaneous', 'expense', 'more-horizontal', '#94a3b8', 'wants'),

  ('Account Transfer', 'transfer', 'arrow-left-right', '#6366f1', null),

  ('Mutual Funds', 'investment', 'pie-chart', '#0ea5e9', 'savings'),
  ('Stocks', 'investment', 'candlestick-chart', '#0ea5e9', 'savings'),
  ('Crypto', 'investment', 'bitcoin', '#0ea5e9', 'savings'),
  ('Gold', 'investment', 'coins', '#0ea5e9', 'savings'),
  ('EPF / PPF / NPS', 'investment', 'landmark', '#0ea5e9', 'savings'),
  ('Emergency Fund', 'investment', 'life-buoy', '#0ea5e9', 'savings');
