#!/bin/bash
# A/B Testing Framework for Karma Architecture Evaluation
# Usage: ./scripts/ab-test.sh [setup|run|test|report|cleanup]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config/ab-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_usage() {
    cat << EOF
Karma A/B Testing Framework

Usage: $0 [command]

Commands:
    setup       Create A/B test configurations
    run         Start both Control (A) and Variant (B) containers
    test        Run 20-round simulation test on both variants
    report      Generate comparison report
    cleanup     Stop containers and clean up

Examples:
    $0 setup
    $0 run
    $0 test
    $0 report
    $0 cleanup
EOF
}

# Setup A/B test configurations
do_setup() {
    log_info "Setting up A/B test configurations..."

    mkdir -p "$CONFIG_DIR"

    # Control (A) - Full configuration
    cat > "$CONFIG_DIR/config-a.yaml" << 'EOF'
# Control Configuration (A) - Full/Original
extraction:
  mode: xml  # XML tags + regex fallback

prompts:
  mode: full  # Use all prompt files

skills:
  mode: full  # Load all skills
EOF

    # Variant (B) - Simplified configuration
    cat > "$CONFIG_DIR/config-b.yaml" << 'EOF'
# Variant Configuration (B) - Simplified
extraction:
  mode: json  # Direct JSON output from AI

prompts:
  mode: minimal  # Use only essential prompts

skills:
  mode: minimal  # Load only core skills
EOF

    log_success "Configuration files created in $CONFIG_DIR"
    log_info "  - config-a.yaml (Control - Full)"
    log_info "  - config-b.yaml (Variant - Simplified)"
}

# Run A/B test containers
do_run() {
    log_info "Starting A/B test containers..."

    # Check if docker-compose.ab.yml exists
    if [ ! -f "$PROJECT_ROOT/docker-compose.ab.yml" ]; then
        log_error "docker-compose.ab.yml not found. Creating it..."
        create_docker_compose_ab
    fi

    cd "$PROJECT_ROOT"

    # Build images
    log_info "Building Docker images..."
    docker build -t karma-test:control --build-arg AB_CONFIG=config-a.yaml .
    docker build -t karma-test:variant --build-arg AB_CONFIG=config-b.yaml .

    # Start containers
    log_info "Starting containers..."
    docker run -d --name karma-control -p 3001:3080 karma-test:control
    docker run -d --name karma-variant -p 3002:3080 karma-test:variant

    log_success "Containers started:"
    log_info "  Control (A): http://localhost:3001"
    log_info "  Variant (B): http://localhost:3002"
}

# Run 20-round test on both variants
do_test() {
    log_info "Running 20-round A/B test..."

    local RESULTS_DIR="$PROJECT_DIR/ab-results-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$RESULTS_DIR"

    # Test Control (A)
    log_info "Testing Control (A) on port 3001..."
    run_20_rounds "http://localhost:3001" "$RESULTS_DIR/control.log"

    # Test Variant (B)
    log_info "Testing Variant (B) on port 3002..."
    run_20_rounds "http://localhost:3002" "$RESULTS_DIR/variant.log"

    log_success "Test results saved to $RESULTS_DIR"
}

run_20_rounds() {
    local URL=$1
    local OUTPUT=$2

    # Create session
    SESSION_RESP=$(curl -s -X POST "$URL/api/session" -H "Content-Type: application/json" -d '{}')
    SESSION_ID=$(echo "$SESSION_RESP" | grep -o '"sessionId":"[^"]*"' | sed 's/"sessionId":"//;s/"$//')

    if [ -z "$SESSION_ID" ]; then
        log_error "Failed to create session for $URL"
        return 1
    fi

    # Test messages
    local MESSAGES=(
        "你好，我是1990年5月15日早上6点生的，男，北京人"
        "我还没结婚"
        "工作上有瓶颈"
        "收入一般"
        "你觉得我今年运势怎么样"
        "健康方面有什么要注意的吗"
        "我和父母关系一般"
        "有个姐姐"
        "想创业"
        "你觉得我适合做什么行业"
        "财运怎么样"
        "这几年会有大的变动吗"
        "我该不该买房"
        "什么时候结婚比较好"
        "对象是什么样的人"
        "会有孩子吗"
        "老了会怎么样"
        "你说的这些准吗"
        "好的谢谢"
        "再见"
    )

    echo "=== A/B Test Results ===" > "$OUTPUT"
    echo "URL: $URL" >> "$OUTPUT"
    echo "Session: $SESSION_ID" >> "$OUTPUT"
    echo "Time: $(date)" >> "$OUTPUT"
    echo "" >> "$OUTPUT"

    local SUCCESS=0
    local FAILED=0

    for i in "${!MESSAGES[@]}"; do
        round=$((i + 1))
        msg="${MESSAGES[$i]}"

        response=$(curl -s -N "$URL/api/chat" \
            -H "Content-Type: application/json" \
            -H "Accept: text/event-stream" \
            -d "{\"message\": \"$msg\", \"sessionId\": \"$SESSION_ID\"}" \
            --max-time 60 2>&1)

        if [ -n "$response" ] && echo "$response" | grep -q "done"; then
            echo "Round $round: ✓" >> "$OUTPUT"
            SUCCESS=$((SUCCESS + 1))
        else
            echo "Round $round: ✗" >> "$OUTPUT"
            FAILED=$((FAILED + 1))
        fi

        sleep 0.5
    done

    echo "" >> "$OUTPUT"
    echo "Success: $SUCCESS / 20" >> "$OUTPUT"
    echo "Failed: $FAILED" >> "$OUTPUT"
}

# Generate comparison report
do_report() {
    log_info "Generating A/B comparison report..."

    local LATEST_RESULTS=$(ls -dt "$PROJECT_ROOT"/ab-results-* 2>/dev/null | head -1)

    if [ -z "$LATEST_RESULTS" ]; then
        log_error "No test results found. Run 'test' first."
        exit 1
    fi

    local REPORT="$PROJECT_ROOT/ab-report-$(date +%Y%m%d-%H%M%S).md"

    cat > "$REPORT" << EOF
# A/B Test Comparison Report

**Generated**: $(date)
**Results Dir**: $LATEST_RESULTS

## Test Results

### Control (A) - Full Configuration
\`\`\`
$(cat "$LATEST_RESULTS/control.log")
\`\`\`

### Variant (B) - Simplified Configuration
\`\`\`
$(cat "$LATEST_RESULTS/variant.log")
\`\`\`

## Analysis

| Metric | Control (A) | Variant (B) | Difference |
|--------|-------------|-------------|------------|
| Success Rate | - | - | - |
| Avg Response Time | - | - | - |
| Error Count | - | - | - |

## Recommendation

- [ ] Information extraction accuracy difference < 5%
- [ ] No new P0 issues introduced
- [ ] Overall score difference < 0.5

## Decision

_TBD after analysis_
EOF

    log_success "Report generated: $REPORT"
}

# Cleanup containers
do_cleanup() {
    log_info "Cleaning up A/B test containers..."

    docker stop karma-control karma-variant 2>/dev/null || true
    docker rm karma-control karma-variant 2>/dev/null || true
    docker rmi karma-test:control karma-test:variant 2>/dev/null || true

    log_success "Cleanup complete"
}

create_docker_compose_ab() {
    cat > "$PROJECT_ROOT/docker-compose.ab.yml" << 'EOF'
version: '3.8'

services:
  control:
    build:
      context: .
      args:
        AB_CONFIG: config-a.yaml
    ports:
      - "3001:3080"
    environment:
      - AB_MODE=control
    container_name: karma-control

  variant:
    build:
      context: .
      args:
        AB_CONFIG: config-b.yaml
    ports:
      - "3002:3080"
    environment:
      - AB_MODE=variant
    container_name: karma-variant
EOF
    log_info "Created docker-compose.ab.yml"
}

# Main entry point
case "${1:-}" in
    setup)
        do_setup
        ;;
    run)
        do_run
        ;;
    test)
        do_test
        ;;
    report)
        do_report
        ;;
    cleanup)
        do_cleanup
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
