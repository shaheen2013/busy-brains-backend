Table users {
  id varchar [pk] // Clerk user ID
  name varchar
  email varchar [unique]
  phone varchar [null]
  location varchar [null]
  created_at timestamp
}

Table plans {
  id uuid [pk]

  name varchar // Solo Explorer | Family Pack
  price int
  max_children int

  stripe_price_id varchar
  currency varchar

  created_at timestamp
}

Table user_plans {
  id uuid [pk]

  user_id varchar [ref: > users.id]
  plan_id uuid [ref: > plans.id]

  is_trial boolean
  trial_started_at timestamp
  trial_ends_at timestamp

  is_active boolean
  purchased_at timestamp [null]

  created_at timestamp
}

Table children {
  id uuid [pk]

  user_id varchar [ref: > users.id]

  name varchar
  age int
  gender varchar

  created_at timestamp
}

Table payment_history {
  id uuid [pk]

  user_id varchar [ref: > users.id]
  payment_id uuid [ref: > user_plans.id]
  plan_id uuid [ref: > plans.id]

  amount int
  currency varchar

  stripe_payment_intent_id varchar
  stripe_checkout_session_id varchar

  status varchar // success | failed | refunded

  created_at timestamp
}

// Progress tracking: module → quest → screen

Table child_modules {
  id uuid [pk]

  child_id uuid [ref: > children.id]
  module_no int

  is_completed boolean
  completed_at timestamp [null]

  created_at timestamp
}

Table child_quests {
  id uuid [pk]

  module_id uuid [ref: > child_modules.id]
  quest_no int

  is_completed boolean
  completed_at timestamp [null]

  created_at timestamp
}

Table child_screens {
  id uuid [pk]

  quest_id uuid [ref: > child_quests.id]
  screen_no int

  data json [null] // screen content + configuration

  is_completed boolean
  completed_at timestamp [null]

  created_at timestamp
}
