def conversation_group_name(conversation_id: str) -> str:
    return f"chat.conversation.{conversation_id}"


def notification_group_name(user_id: str) -> str:
    return f"notifications.user.{user_id}"
