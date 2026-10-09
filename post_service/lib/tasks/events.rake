namespace :events do
  desc "Consume user lifecycle events and maintain the local author profile projection"
  task consume: :environment do
    brokers = ENV.fetch("KAFKA_BROKERS")
    kafka = Kafka.new(seed_brokers: brokers.split(","))
    consumer = kafka.consumer(group_id: ENV.fetch("KAFKA_GROUP_ID", "post-service"))
    consumer.subscribe("user-events", start_from_beginning: true)

    Rails.logger.info("Consuming user-events from #{brokers}")
    consumer.each_message do |message|
      event = JSON.parse(message.value)
      next unless event["event_type"] == "user.created"

      data = event.fetch("data")
      AuthorProfile.upsert(
        {
          user_id: data.fetch("user_id"),
          name: data.fetch("name"),
          created_at: Time.current,
          updated_at: Time.current
        },
        unique_by: :user_id
      )
      Rails.logger.info("Applied #{event.fetch('event_type')} for user #{data.fetch('user_id')}")
    end
  ensure
    consumer&.stop
  end
end
