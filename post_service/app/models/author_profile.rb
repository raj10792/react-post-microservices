class AuthorProfile < ApplicationRecord
  self.primary_key = :user_id

  validates :user_id, presence: true, uniqueness: true
  validates :name, presence: true
end
