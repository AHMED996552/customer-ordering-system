from datetime import datetime
import random

def generate_user_id() -> str:
    date_str = datetime.now().strftime("%Y%m%d")
    random_num = f"{random.randint(0, 99999):05d}"
    return f"USR-{date_str}-{random_num}"
