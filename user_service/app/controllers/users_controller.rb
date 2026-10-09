# user_service/app/controllers/users_controller.rb
class UsersController < ApplicationController
  skip_before_action :authorize_request, only: [ :create, :index, :show ]

  def create
    user = User.new(user_params)
    if user.save
      EventPublisher.publish(
        "user.created",
        user_id: user.id,
        name: user.name
      )
      render json: auth_response(user), status: :created
    else
      render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def index
    users = User.select(:id, :name).order(:id)
    users = users.where(id: params[:ids]) if params[:ids].present?
    render json: users
  end

  def show
    user = User.find(params[:id])
    render json: user.as_json(only: [ :id, :name ])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  private
  def user_params
    params.require(:user).permit(:name, :email, :password)
  end

  def auth_response(user)
    {
      token: JsonWebToken.encode(user.id),
      user: user.as_json(only: [ :id, :name, :email ])
    }
  end
end
