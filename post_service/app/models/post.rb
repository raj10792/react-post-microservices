class Post < ApplicationRecord
  has_many :comments, dependent: :destroy
  validates :title, presence: true, length: { maximum: 120 }
  validates :content, presence: true, length: { maximum: 5000 }
  validates :user_id, presence: true
end
