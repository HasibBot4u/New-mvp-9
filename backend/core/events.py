class EventBus:
    """Mock event bus for pub/sub."""
    @classmethod
    async def publish(cls, event_name: str, payload: dict):
        pass
        
    @classmethod
    async def subscribe(cls, event_name: str, handler):
        pass
