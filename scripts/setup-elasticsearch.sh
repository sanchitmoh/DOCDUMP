#!/bin/bash

# Corporate Digital Library - Elasticsearch Setup Script
# =====================================================

set -e

echo "🚀 Setting up Elasticsearch for Corporate Digital Library..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ELASTICSEARCH_URL="http://localhost:9200"
ELASTICSEARCH_USER="elastic"
ELASTICSEARCH_PASSWORD="CorporateLib2024!"
INDEX_PREFIX="corporate"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Elasticsearch is running
check_elasticsearch() {
    print_status "Checking Elasticsearch connection..."
    
    if curl -s -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" "$ELASTICSEARCH_URL" > /dev/null; then
        print_success "Elasticsearch is running and accessible"
        return 0
    else
        print_error "Cannot connect to Elasticsearch at $ELASTICSEARCH_URL"
        return 1
    fi
}

# Function to wait for Elasticsearch to be ready
wait_for_elasticsearch() {
    print_status "Waiting for Elasticsearch to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if check_elasticsearch; then
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    print_error "Elasticsearch did not become ready within the timeout period"
    return 1
}

# Function to create directories
create_directories() {
    print_status "Creating required directories..."
    
    mkdir -p elasticsearch/data
    mkdir -p elasticsearch/logs
    mkdir -p elasticsearch/plugins
    mkdir -p kibana/data
    
    # Set proper permissions
    chmod 755 elasticsearch/data
    chmod 755 elasticsearch/logs
    chmod 755 kibana/data
    
    print_success "Directories created successfully"
}

# Function to start Elasticsearch with Docker Compose
start_elasticsearch() {
    print_status "Starting Elasticsearch and Kibana with Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Create directories first
    create_directories
    
    # Start services
    docker-compose -f docker-compose.elasticsearch.yml up -d
    
    print_success "Docker Compose services started"
    
    # Wait for services to be ready
    wait_for_elasticsearch
}

# Function to create index templates
create_index_templates() {
    print_status "Creating index templates..."
    
    # Documents index template
    curl -s -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" \
        -X PUT "$ELASTICSEARCH_URL/_index_template/${INDEX_PREFIX}_documents_template" \
        -H "Content-Type: application/json" \
        -d '{
            "index_patterns": ["'${INDEX_PREFIX}'_documents*"],
            "template": {
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 1,
                    "refresh_interval": "5s"
                }
            },
            "priority": 100
        }' > /dev/null
    
    # Audit logs index template
    curl -s -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" \
        -X PUT "$ELASTICSEARCH_URL/_index_template/${INDEX_PREFIX}_audit_logs_template" \
        -H "Content-Type: application/json" \
        -d '{
            "index_patterns": ["'${INDEX_PREFIX}'_audit_logs*"],
            "template": {
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 1,
                    "refresh_interval": "1s"
                }
            },
            "priority": 100
        }' > /dev/null
    
    print_success "Index templates created"
}

# Function to create indices
create_indices() {
    print_status "Creating Elasticsearch indices..."
    
    # Create documents index
    if [ -f "elasticsearch/mappings/documents.json" ]; then
        curl -s -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" \
            -X PUT "$ELASTICSEARCH_URL/${INDEX_PREFIX}_documents" \
            -H "Content-Type: application/json" \
            -d @elasticsearch/mappings/documents.json > /dev/null
        print_success "Documents index created"
    else
        print_warning "Documents mapping file not found, skipping..."
    fi
    
    # Create audit logs index
    if [ -f "elasticsearch/mappings/audit_logs.json" ]; then
        curl -s -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" \
            -X PUT "$ELASTICSEARCH_URL/${INDEX_PREFIX}_audit_logs" \
            -H "Content-Type: application/json" \
            -d @elasticsearch/mappings/audit_logs.json > /dev/null
        print_success "Audit logs index created"
    else
        print_warning "Audit logs mapping file not found, skipping..."
    fi
}

# Function to create ILM policies
create_ilm_policies() {
    print_status "Creating Index Lifecycle Management policies..."
    
    # Audit logs ILM policy
    curl -s -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" \
        -X PUT "$ELASTICSEARCH_URL/_ilm/policy/audit_logs_policy" \
        -H "Content-Type: application/json" \
        -d '{
            "policy": {
                "phases": {
                    "hot": {
                        "actions": {
                            "rollover": {
                                "max_size": "1GB",
                                "max_age": "7d"
                            }
                        }
                    },
                    "warm": {
                        "min_age": "7d",
                        "actions": {
                            "allocate": {
                                "number_of_replicas": 0
                            }
                        }
                    },
                    "cold": {
                        "min_age": "30d",
                        "actions": {
                            "allocate": {
                                "number_of_replicas": 0
                            }
                        }
                    },
                    "delete": {
                        "min_age": "90d"
                    }
                }
            }
        }' > /dev/null
    
    print_success "ILM policies created"
}

# Function to verify setup
verify_setup() {
    print_status "Verifying Elasticsearch setup..."
    
    # Check cluster health
    local health=$(curl -s -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" "$ELASTICSEARCH_URL/_cluster/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$health" = "green" ] || [ "$health" = "yellow" ]; then
        print_success "Cluster health: $health"
    else
        print_error "Cluster health: $health"
        return 1
    fi
    
    # List indices
    print_status "Created indices:"
    curl -s -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" "$ELASTICSEARCH_URL/_cat/indices/${INDEX_PREFIX}_*?v" | head -10
    
    print_success "Elasticsearch setup completed successfully!"
}

# Function to show connection info
show_connection_info() {
    echo ""
    echo "🎉 Elasticsearch Setup Complete!"
    echo "=================================="
    echo ""
    echo "Elasticsearch URL: $ELASTICSEARCH_URL"
    echo "Username: $ELASTICSEARCH_USER"
    echo "Password: $ELASTICSEARCH_PASSWORD"
    echo ""
    echo "Kibana URL: http://localhost:5601"
    echo "Username: $ELASTICSEARCH_USER"
    echo "Password: $ELASTICSEARCH_PASSWORD"
    echo ""
    echo "Elasticsearch Head: http://localhost:9100"
    echo ""
    echo "To test the connection:"
    echo "curl -u $ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD $ELASTICSEARCH_URL"
    echo ""
    echo "To stop the services:"
    echo "docker-compose -f docker-compose.elasticsearch.yml down"
    echo ""
}

# Main execution
main() {
    echo "🏢 Corporate Digital Library - Elasticsearch Setup"
    echo "=================================================="
    echo ""
    
    # Check if already running
    if check_elasticsearch; then
        print_warning "Elasticsearch is already running"
        read -p "Do you want to recreate the indices? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            create_index_templates
            create_indices
            create_ilm_policies
            verify_setup
        fi
    else
        # Full setup
        start_elasticsearch
        create_index_templates
        create_indices
        create_ilm_policies
        verify_setup
    fi
    
    show_connection_info
}

# Run main function
main "$@"