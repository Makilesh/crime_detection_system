def score_incident(detections):
    """
    Given a list of DetectionResult dicts/objects, determine the threat level 
    and provide a human-readable reason.
    
    DetectionResult schema:
    {
        "type": str,          # 'intrusion', 'violence', 'face', 'loitering', 'tamper', 'anpr', 'weapon'
        "confidence": float,  # 0.0 to 1.0
        "details": str
    }
    """
    if not detections:
        return "low", "No active threats detected"

    # Extract types
    types = [d["type"] for d in detections]
    has_violence = "violence" in types
    has_tamper = "tamper" in types
    has_wanted_face = any(d["type"] == "face" and d.get("wanted_match", False) for d in detections)
    has_weapon = "weapon" in types
    has_unknown_restricted_face = any(d["type"] == "face" and not d.get("wanted_match", False) and d.get("restricted_zone", False) for d in detections)
    
    # 1. High Severity triggers
    if has_violence:
        return "high", "Physical conflict/aggression detected in live stream"
    if has_tamper:
        return "high", "Camera tampering detected (severe structural frame shift)"
    if has_wanted_face:
        return "high", "Wanted person facial match confirmed by DeepFace pipeline"
    if len(detections) >= 3:
        return "high", f"Multiple concurrent security threats detected ({', '.join(types)})"

    # 2. Medium Severity triggers
    if has_weapon:
        return "medium", "Suspicious weapon-like object detected"
    if has_unknown_restricted_face:
        return "medium", "Unknown facial signature detected in restricted zone"
    if "intrusion" in types:
        return "medium", "Unauthorized person intrusion in guard polygon zone"

    # 3. Low Severity triggers
    if "loitering" in types:
        return "low", "Subject loitering beyond configured dwell duration"
    if "anpr" in types:
        return "low", "Vehicle license plate recorded at checkpoint"
        
    return "low", f"Minor activity detected: {', '.join(types)}"
