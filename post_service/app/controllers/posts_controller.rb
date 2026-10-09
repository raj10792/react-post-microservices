class PostsController < ApplicationController
  skip_before_action :authorize_request, only: [ :index, :show ]
  before_action :set_post, only: [ :show, :destroy ]

  def index
    posts = Post.includes(:comments).order(created_at: :desc).limit(50)
    render json: posts.map { |post| serialize_post(post) }
  end

  def create
    post = Post.new(post_params.merge(user_id: @current_user_id))

    if post.save
      EventPublisher.publish(
        "post.created",
        post_id: post.id,
        user_id: post.user_id,
        title: post.title
      )
      render json: serialize_post(post), status: :created
    else
      render json: { errors: post.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def show
    render json: serialize_post(@post)
  end

  def destroy
    return render_forbidden unless @post.user_id == @current_user_id

    @post.destroy!
    EventPublisher.publish("post.deleted", post_id: @post.id, user_id: @current_user_id)
    head :no_content
  end

  private

  def set_post
    @post = Post.includes(:comments).find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Post not found" }, status: :not_found
  end

  def post_params
    params.require(:post).permit(:title, :content)
  end

  def serialize_post(post)
    {
      id: post.id,
      title: post.title,
      content: post.content,
      user_id: post.user_id,
      created_at: post.created_at,
      updated_at: post.updated_at,
      author: serialize_author(post.user_id),
      comments: post.comments.map { |comment| serialize_comment(comment) }
    }
  end

  def serialize_comment(comment)
    {
      id: comment.id,
      content: comment.content,
      user_id: comment.user_id,
      created_at: comment.created_at,
      author: serialize_author(comment.user_id)
    }
  end

  def serialize_author(user_id)
    author = AuthorProfile.find_by(user_id: user_id)
    { id: user_id, name: author&.name || "New member" }
  end

  def render_forbidden
    render json: { error: "You can only delete your own posts" }, status: :forbidden
  end
end
