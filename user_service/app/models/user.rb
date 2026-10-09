class User < ApplicationRecord
  has_secure_password
  before_validation { self.email = email.to_s.strip.downcase }

  validates :name, presence: true, length: { maximum: 80 }
  validates :email, presence: true, uniqueness: { case_sensitive: false },
    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, length: { minimum: 8 }, if: -> { password.present? }
end
