import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VoiceAlert")

def make_voice_call(police_phone, incident_type, location, timestamp):
    """
    Triggers an outbound voice alert call to the target police station number
    using Twilio Programmable Voice. Falls back to logging if keys are missing.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER", "+15551234567")

    alert_message = f"Alert. {incident_type.replace('_', ' ')} detected at {location} at {timestamp}. Severity is high. A full incident dispatch report has been sent to your command console."

    if not account_sid or not auth_token:
        logger.info("Twilio keys not configured. Logging Mock Outbound Call:")
        logger.info(f"OUTBOUND TO STATION: {police_phone}")
        logger.info(f"VOICE MESSAGE: {alert_message}")
        return True

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        
        # Twilio TwiML instructions for speaking text
        twiml_msg = f"<Response><Say voice='alice'>{alert_message}</Say></Response>"
        
        call = client.calls.create(
            to=police_phone,
            from_=from_number,
            twiml=twiml_msg
        )
        logger.info(f"Twilio call dispatched successfully! SID: {call.sid}")
        return True
    except Exception as e:
        logger.error(f"Failed to dispatch Twilio outbound call: {str(e)}")
        return False
