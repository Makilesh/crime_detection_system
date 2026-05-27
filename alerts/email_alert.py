import os
import logging

# Setup basic logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("EmailAlert")

def send_email_alert(incident_type, location, timestamp, intensity, details):
    """
    Sends an email alert to the configured officer distribution list.
    Integrates SendGrid if SENDGRID_API_KEY env variable is present,
    otherwise falls back to logging.
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    to_email = os.getenv("OFFICER_EMAIL_LIST", "officer.on.duty@police.gov")
    from_email = os.getenv("SENDGRID_FROM_EMAIL", "alerts@crimedetection.security")

    subject = f"[ALERT] {intensity.upper()} SEVERITY: {incident_type.upper()} at {location}"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e1e8ed; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="background-color: {'#ff0055' if intensity == 'high' else '#ff9900' if intensity == 'medium' else '#0070f3'}; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px;">Crime Detection AI Alert System</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Real-Time Crime & Threat Dispatch</p>
                </div>
                <div style="padding: 20px; color: #333333; line-height: 1.6;">
                    <p><strong>Incident Type:</strong> {incident_type.replace('_', ' ').title()}</p>
                    <p><strong>Location:</strong> {location}</p>
                    <p><strong>Timestamp:</strong> {timestamp}</p>
                    <p><strong>Severity Scored:</strong> <span style="padding: 3px 8px; border-radius: 4px; background: #ffe5ec; color: #ff0055; font-weight: bold; font-size: 12px;">{intensity.upper()}</span></p>
                    <p><strong>Incident Details:</strong> {details}</p>
                    <div style="margin-top: 25px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #00f0ff; font-size: 13px;">
                        Please log in to the Central Command Dashboard to review the live camera coordinates and acknowledge response dispatch.
                    </div>
                </div>
            </div>
        </body>
    </html>
    """

    if not api_key:
        logger.info(f"SendGrid API Key not configured. Logging Mock Email Alert:")
        logger.info(f"TO: {to_email}")
        logger.info(f"SUBJECT: {subject}")
        logger.info(f"BODY: {details}")
        return True

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=subject,
            html_content=html_content
        )
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        logger.info(f"Email alert sent successfully via SendGrid! Status code: {response.status_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to dispatch email alert via SendGrid: {str(e)}")
        return False
