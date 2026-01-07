#!/bin/bash
# LocalStack initialization script
# Creates DynamoDB tables, Kafka topics, and other AWS resources

set -e

echo "Waiting for LocalStack to be ready..."
until aws --endpoint-url=http://localhost:4566 dynamodb list-tables > /dev/null 2>&1; do
  echo "Waiting for LocalStack..."
  sleep 2
done

echo "LocalStack is ready!"

# Create DynamoDB messages table
echo "Creating DynamoDB 'messages' table..."
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name messages \
  --attribute-definitions \
    AttributeName=conversation_id,AttributeType=S \
    AttributeName=seq,AttributeType=N \
  --key-schema \
    AttributeName=conversation_id,KeyType=HASH \
    AttributeName=seq,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1 || echo "Table 'messages' already exists"

echo "LocalStack initialization complete!"
