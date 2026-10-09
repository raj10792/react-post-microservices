class Comment < ApplicationRecord
  belongs_to :post
  validates :content, presence: true, length: { maximum: 1000 }
  validates :user_id, presence: true
end
