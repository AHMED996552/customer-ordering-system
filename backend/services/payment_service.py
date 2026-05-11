class PaymentError(Exception):
    pass

class PaymentGatewayService:
    @staticmethod
    def charge(token, amount):
        """
        Simulates charging a card via an external gateway.
        Raises PaymentError if declined or fails.
        """
        # A simple simulation: if token equals 'FAIL', we raise an error.
        # Otherwise, assume success.
        if token == "FAIL":
            raise PaymentError("Insufficient funds or card declined.")
            
        return {
            "status": "SUCCESS",
            "txn_id": "sim_txn_987654321",
            "charged_amount": amount
        }
