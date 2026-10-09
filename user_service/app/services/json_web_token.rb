class JsonWebToken
  ALGORITHM = "HS256"

  def self.encode(user_id)
    JWT.encode(
      { user_id: user_id, exp: 24.hours.from_now.to_i },
      secret,
      ALGORITHM
    )
  end

  def self.decode(token)
    JWT.decode(token, secret, true, algorithm: ALGORITHM).first
  end

  def self.secret
    ENV.fetch("JWT_SECRET") { Rails.application.secret_key_base }
  end
  private_class_method :secret
end
