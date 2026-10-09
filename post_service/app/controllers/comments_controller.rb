class CommentsController < ApplicationController
  skip_before_action :authorize_request, only: [ :index ]
  before_action :set_post

  def index
    render json: @post.comments.order(:created_at).map { |comment| serialize_comment(comment) }
  end

  def create
    comment = @post.comments.new(comment_params.merge(user_id: @current_user_id))

    if comment.save
      EventPublisher.publish(
        "comment.created",
        comment_id: comment.id,
        post_id: comment.post_id,
        user_id: comment.user_id
      )
      render json: serialize_comment(comment), status: :created
    else
      render json: { errors: comment.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    comment = @post.comments.find(params[:id])
    return render json: { error: "You can only delete your own replies" }, status: :forbidden unless comment.user_id == @current_user_id

    comment.destroy!
    EventPublisher.publish(
      "comment.deleted",
      comment_id: comment.id,
      post_id: @post.id,
      user_id: @current_user_id
    )
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Reply not found" }, status: :not_found
  end

  private

  def set_post
    @post = Post.find(params[:post_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Post not found" }, status: :not_found
  end

  def comment_params
    params.require(:comment).permit(:content)
  end

  def serialize_comment(comment)
    author = AuthorProfile.find_by(user_id: comment.user_id)
    {
      id: comment.id,
      content: comment.content,
      user_id: comment.user_id,
      post_id: comment.post_id,
      created_at: comment.created_at,
      author: { id: comment.user_id, name: author&.name || "New member" }
    }
  end
end
