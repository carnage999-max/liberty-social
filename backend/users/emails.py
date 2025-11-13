from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.utils import timezone
from django.conf import settings


def send_templated_email(template_name, context, subject, to_email):
    """
    Send an HTML email using a template.

    Args:
        template_name (str): Name of the template to use (without .html extension)
        context (dict): Context data for the template
        subject (str): Email subject
        to_email (str): Recipient email address
    """
    # Add common context variables
    context.update(
        {
            "subject": subject,
            "year": timezone.now().year,
        }
    )

    # Render the HTML content
    html_content = render_to_string(f"emails/{template_name}.html", context)

    # Create and send the email
    email = EmailMessage(
        subject=subject,
        body=html_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    email.content_subtype = "html"  # Set content type to HTML
    return email.send()


def send_welcome_email(user):
    """Send a welcome email to a new user."""
    profile_url = f"{settings.FRONTEND_URL}/app/settings"
    context = {
        "user": user,
        "profile_url": profile_url,
    }
    return send_templated_email(
        "welcome", context, "Welcome to Liberty Social!", user.email
    )


def send_password_changed_email(user):
    """Send a confirmation email when a user changes their password."""
    password_reset_url = f"{settings.FRONTEND_URL}/auth/reset-password"
    context = {
        "user": user,
        "timestamp": timezone.now().strftime("%B %d, %Y at %I:%M %p"),
        "password_reset_url": password_reset_url,
    }
    return send_templated_email(
        "password_changed", context, "Your password has been changed", user.email
    )


def send_password_reset_email(user, reset_url):
    """Send a password reset email to a user."""
    context = {
        "user": user,
        "reset_url": reset_url,
    }
    return send_templated_email(
        "password_reset", context, "Reset your Liberty Social password", user.email
    )


def send_password_change_request_email(user, change_url):
    """Send a password change request email to an authenticated user."""
    context = {
        "user": user,
        "change_url": change_url,
    }
    return send_templated_email(
        "password_change_request",
        context,
        "Change your Liberty Social password",
        user.email,
    )


def send_page_admin_invite_email(invitee, inviter, page):
    """Send a page admin invitation email to a user."""
    inviter_name = (
        f"{inviter.first_name} {inviter.last_name}".strip() or inviter.username
    )
    invitation_url = f"{settings.FRONTEND_URL}/app/admin-invites"

    context = {
        "invitee": invitee,
        "inviter_name": inviter_name,
        "page_name": page.name,
        "role": page.admin_invites.filter(invitee=invitee).latest("id").role,
        "invitation_url": invitation_url,
    }

    return send_templated_email(
        "page_admin_invite",
        context,
        f"You've been invited to manage {page.name}",
        invitee.email,
    )
