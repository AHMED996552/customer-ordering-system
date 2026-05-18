import bcrypt
from backend.extensions import db
from backend.utils.generators import generate_user_id
from datetime import datetime, timezone

class User(db.Model):
    __tablename__ = 'Users'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), unique=True, nullable=False, default=generate_user_id)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)

    status = db.Column(
        db.String(50),
        nullable=False,
        default="PENDING_VERIFICATION"
    )

    failed_attempts = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    lockout_expires_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.String(50),
        nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat()
    )

    otp_code = db.Column(db.String(6), nullable=True)
    otp_expires_at = db.Column(db.String(50), nullable=True)

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    def check_password(self, password):
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "email": self.email,
            "full_name": self.full_name,
            "phone_number": self.phone_number,
            "status": self.status,
            "created_at": self.created_at
        }
