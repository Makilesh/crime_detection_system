#!/usr/bin/env bash
# File: scripts/probe_ports.sh
# Probe 192.168.1.8 for open RTSP, Web, and ONVIF ports

TARGET_IP="192.168.1.8"
PORTS=(554 8554 80 8080 8899)
LOG_FILE="ports_probe.log"

echo "=== Camera Port Scan for $TARGET_IP ===" | tee "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"
echo "------------------------------------------------" | tee -a "$LOG_FILE"

# 1. Probe using Nmap if available
if command -v nmap &> /dev/null; then
    echo "Running nmap port scan..." | tee -a "$LOG_FILE"
    ports_str=$(IFS=,; echo "${PORTS[*]}")
    nmap -p "$ports_str" "$TARGET_IP" 2>&1 | tee -a "$LOG_FILE"
else
    echo "nmap is not installed or not in PATH. Skipping nmap scan." | tee -a "$LOG_FILE"
fi

echo "------------------------------------------------" | tee -a "$LOG_FILE"

# 2. Probe using Netcat (nc)
echo "Testing port connectivity using netcat (nc)..." | tee -a "$LOG_FILE"
for port in "${PORTS[@]}"; do
    echo -n "Port $port: " | tee -a "$LOG_FILE"
    
    # Try nc with 2-second timeout
    if command -v nc &> /dev/null; then
        nc -z -w 2 "$TARGET_IP" "$port" &> /dev/null
        if [ $? -eq 0 ]; then
            echo "OPEN" | tee -a "$LOG_FILE"
        else
            echo "CLOSED" | tee -a "$LOG_FILE"
        fi
    elif command -v netcat &> /dev/null; then
        netcat -z -w 2 "$TARGET_IP" "$port" &> /dev/null
        if [ $? -eq 0 ]; then
            echo "OPEN" | tee -a "$LOG_FILE"
        else
            echo "CLOSED" | tee -a "$LOG_FILE"
        fi
    else
        # Fallback to bash pseudo-device if available
        (echo > "/dev/tcp/$TARGET_IP/$port") &>/dev/null
        if [ $? -eq 0 ]; then
            echo "OPEN (bash redirect)" | tee -a "$LOG_FILE"
        else
            echo "CLOSED or /dev/tcp unavailable" | tee -a "$LOG_FILE"
        fi
    fi
done

echo "------------------------------------------------" | tee -a "$LOG_FILE"
echo "Port probe finished. Results saved to $LOG_FILE" | tee -a "$LOG_FILE"
