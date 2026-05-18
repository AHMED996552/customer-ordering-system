import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.config import Config

def send_verification_email(email: str, user_id: str, otp_code: str = None):
    """
    Sends a beautifully designed HTML OTP verification card to the user.
    """
    if not otp_code:
        return
        
    sender_email = Config.MAIL_USERNAME
    sender_password = Config.MAIL_PASSWORD
    
    if not sender_email or not sender_password:
        print("Warning: Email credentials not configured. OTP:", otp_code)
        return

    subject = "Verify your LuxeEats Account"
    
    # 1. Plain Text Fallback Body
    body_text = f"""Hello,

Thank you for registering. Your verification code is: {otp_code}

This code will expire in 10 minutes.

Best,
LuxeEats Team
"""

    # 2. Premium Quiet Luxury HTML Card Body
    body_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your LuxeEats Account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0b0b; font-family: 'Outfit', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0b0b; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Premium Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #141414; border: 1px solid #2a2a2a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header Gold Accent Line -->
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #c5a880, #e6d5b8, #c5a880);"></td>
          </tr>
          
          <!-- Logo & Brand Header -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <h1 style="margin: 0; font-family: 'Times New Roman', Times, serif; font-size: 26px; font-weight: 300; letter-spacing: 6px; color: #e6d5b8; text-transform: uppercase;">LUXE EATS</h1>
              <p style="margin: 5px 0 0 0; font-size: 11px; letter-spacing: 3px; color: #888888; text-transform: uppercase;">Gourmet Concierge</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #222222;"><tr><td></td></tr></table>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 24px; color: #ffffff; font-weight: 400;">Hello,</p>
              <p style="margin: 0 0 25px 0; font-size: 14px; line-height: 22px; color: #b0b0b0; font-weight: 300;">
                Thank you for registering with LuxeEats. To secure your account and access your gourmet dashboard, please use the verification pass code below:
              </p>

              <!-- OTP Code Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td align="center" style="background-color: #1b1b1b; border: 1px dashed #c5a880; border-radius: 12px; padding: 20px;">
                    <div style="font-size: 12px; letter-spacing: 2px; color: #c5a880; text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">Verification Passcode</div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: bold; letter-spacing: 8px; color: #ffffff; line-height: 38px;">{otp_code}</div>
                  </td>
                </tr>
              </table>

              <!-- Security Subtext -->
              <p style="margin: 0 0 15px 0; font-size: 12px; line-height: 18px; color: #888888; font-weight: 300;">
                ⏳ This passcode is highly confidential and will automatically expire in <strong style="color: #c5a880;">10 minutes</strong>.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #888888; font-weight: 300;">
                If you did not initiate this registration request, please disregard this email or contact support.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #222222;"><tr><td></td></tr></table>
            </td>
          </tr>

          <!-- Footer Signature -->
          <tr>
            <td align="center" style="padding: 25px 40px 40px 40px; background-color: #0f0f0f;">
              <p style="margin: 0 0 5px 0; font-size: 13px; color: #e6d5b8; font-weight: 400; font-style: italic;">With compliments,</p>
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #ffffff; font-weight: 600; letter-spacing: 1px;">The LuxeEats Concierge</p>
              <p style="margin: 0; font-size: 10px; color: #666666; letter-spacing: 0.5px;">&copy; 2026 LuxeEats. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    msg = MIMEMultipart('alternative')
    msg['From'] = sender_email
    msg['To'] = email
    msg['Subject'] = subject

    # Attach both plain text and HTML versions
    msg.attach(MIMEText(body_text, 'plain'))
    msg.attach(MIMEText(body_html, 'html'))

    try:
        server = smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT)
        server.starttls()
        server.login(sender_email, sender_password)
        text = msg.as_string()
        server.sendmail(sender_email, email, text)
        server.quit()
        print(f"Successfully sent premium HTML OTP card to {email}")
    except Exception as e:
        print(f"Failed to send email: {e}")
