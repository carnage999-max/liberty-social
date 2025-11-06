def notification_group_name(user_id: int) -> str:
    """Return the channel layer group name for a user's notifications stream."""
    return f"notifications.user.{user_id}"
