class EventPublisher
  def self.publish(event_type, data)
    brokers = ENV["KAFKA_BROKERS"]
    unless brokers.present?
      Rails.logger.info("Kafka event not published: KAFKA_BROKERS is not configured (#{event_type})")
      return
    end

    kafka = Kafka.new(seed_brokers: brokers.split(","))
    producer = kafka.producer
    topic = event_type.start_with?("comment.") || event_type.start_with?("post.") ? "post-events" : "user-events"
    producer.produce(
      {
        event_id: SecureRandom.uuid,
        event_type: event_type,
        occurred_at: Time.current.iso8601,
        data: data
      }.to_json,
      topic: topic,
      key: data[:post_id]&.to_s || data[:user_id]&.to_s
    )
    producer.deliver_messages
  ensure
    producer&.shutdown
  end
end
