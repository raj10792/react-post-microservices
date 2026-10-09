class ApplicationController < ActionController::API
  before_action :authorize_request

  private

  def authorize_request
    scheme, token = request.authorization.to_s.split(" ", 2)
    raise JWT::DecodeError, "Missing bearer token" unless scheme == "Bearer" && token.present?

    payload = JsonWebToken.decode(token)
    @current_user = User.find(payload.fetch("user_id"))
  rescue ActiveRecord::RecordNotFound, JWT::DecodeError, KeyError, ArgumentError
    render json: { error: "Unauthorized" }, status: :unauthorized
  end
end
