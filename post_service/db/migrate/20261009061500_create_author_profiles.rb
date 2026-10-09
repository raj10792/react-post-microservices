class CreateAuthorProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :author_profiles, id: false do |t|
      t.integer :user_id, null: false, primary_key: true
      t.string :name, null: false
      t.timestamps
    end

    add_index :author_profiles, :user_id, unique: true
    add_index :posts, :user_id
    add_index :comments, :post_id
    add_index :comments, :user_id
  end
end
