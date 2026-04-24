Table users {
  id uuid [pk]
  name varchar
  email varchar [unique]
  phone varchar [null]
  location varchar [null]
  created_at timestamp
}

Table plans {
  id uuid [pk]

  name varchar // Solo Explored | Family Pack
  price int
  max_children int

  stripe_price_id varchar
  currency varchar

  created_at timestamp
}

Table user_plans {
  id uuid [pk]

  user_id uuid [ref: > users.id]
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

  user_id uuid [ref: > users.id]

  name varchar
  age int
  gender varchar

  created_at timestamp
}

Table payment_history {
  id uuid [pk]

  user_id uuid [ref: > users.id]
  payment_id uuid [ref: > user_plans.id]
  plan_id uuid [ref: > plans.id]

  amount int
  currency varchar

  stripe_payment_intent_id varchar
  stripe_checkout_session_id varchar

  status varchar // success | failed | refunded

  created_at timestamp
}


/*
  CORE TABLE (everything per child)
  module -> quest -> screen structure + specific key valye pair data + progress
*/
Table children_data_nodes {
  id uuid [pk]

  child_id uuid [ref: > children.id]

  module_no int
  quest_no int [null]
  screen_no int [null]

  type varchar // module | quest | screen
  
  data json // content + configuration (FULL FLEXIBILITY) 

  is_completed boolean
  completed_at timestamp

  created_at timestamp

  /*
    RULES:
    module  => quest_no NULL, screen_no NULL
    quest   => screen_no NULL
    screen  => all fields present
  */
}