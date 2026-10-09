# user_service/app/controllers/sessions_controller.rb
class SessionsController < ApplicationController
  skip_before_action :authorize_request, only: [ :create ]
  def create
    user = User.find_by(email: params[:email])

    if user&.authenticate(params[:password])
      render json: {
        token: JsonWebToken.encode(user.id),
        user: user.as_json(only: [ :id, :name, :email ])
      }, status: :ok
    else
      render json: { error: "Invalid email or password" }, status: :unauthorized
    end
  end
end
