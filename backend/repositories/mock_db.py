class MockDB:
    def __init__(self):
        # Initial simulated state
        self.menu_items = {
            1: {"price_egp": 150.00, "is_available": True},
            2: {"price_egp": 300.00, "is_available": True},
            3: {"price_egp": 50.00, "is_available": False}
        }
        self.orders = {}
        self.processed_idempotency_keys = set()
        
        # Transaction state
        self._in_transaction = False
        self._staged_order = None
        self._staged_key = None

    def get_items(self, item_ids):
        """Returns a dict of item details for requested IDs."""
        return {iid: self.menu_items[iid] for iid in item_ids if iid in self.menu_items}
        
    def check_idempotency_lock(self, idempotency_key):
        """Returns True if key is already processed."""
        return idempotency_key in self.processed_idempotency_keys

    def begin_transaction(self):
        self._in_transaction = True
        self._staged_order = None
        self._staged_key = None

    def stage_order(self, order_data, idempotency_key):
        if not self._in_transaction:
            raise RuntimeError("Must be in transaction to stage order.")
        self._staged_order = order_data
        self._staged_key = idempotency_key

    def commit(self):
        if not self._in_transaction:
            raise RuntimeError("No active transaction.")
        
        if self._staged_key:
            self.processed_idempotency_keys.add(self._staged_key)
            
        if self._staged_order:
            order_id = f"ORD-{len(self.orders) + 1000}"
            self._staged_order["order_id"] = order_id
            self.orders[order_id] = self._staged_order
            
        self._in_transaction = False
        return self._staged_order

    def rollback(self):
        self._in_transaction = False
        self._staged_order = None
        self._staged_key = None

# Global instance for the application to share
db = MockDB()
