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


def send_offer_received_email(offer):
    """Send email to seller when they receive an offer on their listing."""
    seller = offer.listing.seller
    buyer_name = (
        f"{offer.buyer.first_name} {offer.buyer.last_name}".strip()
        or offer.buyer.username
    )
    listing_ref = offer.listing.slug or offer.listing.id
    listing_url = f"{settings.FRONTEND_URL}/app/marketplace/{listing_ref}"
    offers_url = f"{settings.FRONTEND_URL}/app/marketplace/offers"

    context = {
        "seller": seller,
        "buyer_name": buyer_name,
        "listing_title": offer.listing.title,
        "offered_price": offer.offered_price,
        "listing_price": offer.listing.price,
        "message": offer.message,
        "listing_url": listing_url,
        "offers_url": offers_url,
    }

    return send_templated_email(
        "marketplace_offer_received",
        context,
        f"New offer on your listing: {offer.listing.title}",
        seller.email,
    )


def send_offer_accepted_email(offer):
    """Send email to buyer when their offer is accepted."""
    buyer = offer.buyer
    seller_name = (
        f"{offer.listing.seller.first_name} {offer.listing.seller.last_name}".strip()
        or offer.listing.seller.username
    )
    listing_ref = offer.listing.slug or offer.listing.id
    listing_url = f"{settings.FRONTEND_URL}/app/marketplace/{listing_ref}"
    offers_url = f"{settings.FRONTEND_URL}/app/marketplace/offers"

    context = {
        "buyer": buyer,
        "seller_name": seller_name,
        "listing_title": offer.listing.title,
        "offered_price": offer.offered_price,
        "listing_url": listing_url,
        "offers_url": offers_url,
    }

    return send_templated_email(
        "marketplace_offer_accepted",
        context,
        f"Your offer on {offer.listing.title} has been accepted!",
        buyer.email,
    )


def send_offer_declined_email(offer):
    """Send email to buyer when their offer is declined."""
    buyer = offer.buyer
    seller_name = (
        f"{offer.listing.seller.first_name} {offer.listing.seller.last_name}".strip()
        or offer.listing.seller.username
    )
    listing_ref = offer.listing.slug or offer.listing.id
    listing_url = f"{settings.FRONTEND_URL}/app/marketplace/{listing_ref}"
    offers_url = f"{settings.FRONTEND_URL}/app/marketplace/offers"

    context = {
        "buyer": buyer,
        "seller_name": seller_name,
        "listing_title": offer.listing.title,
        "offered_price": offer.offered_price,
        "response_message": offer.response_message,
        "listing_url": listing_url,
        "offers_url": offers_url,
    }

    return send_templated_email(
        "marketplace_offer_declined",
        context,
        f"Your offer on {offer.listing.title} has been declined",
        buyer.email,
    )


def send_page_invite_email(recipient, sender, page):
    """Send email to friend inviting them to follow a page."""
    accept_url = f"{settings.FRONTEND_URL}/app/invites/{page.id}/accept"
    decline_url = f"{settings.FRONTEND_URL}/app/invites/{page.id}/decline"
    page_ref = page.slug or page.id
    page_url = f"{settings.FRONTEND_URL}/app/pages/{page_ref}"

    sender_name = sender.username or sender.email
    context = {
        "recipient_name": recipient.username or recipient.email,
        "sender_name": sender_name,
        "page_name": page.name,
        "page_category": page.category,
        "page_description": page.description,
        "page_image_url": page.profile_image_url,
        "page_url": page_url,
        "accept_url": accept_url,
        "decline_url": decline_url,
    }

    return send_templated_email(
        "page_invite",
        context,
        f"{sender_name} invited you to follow {page.name}",
        recipient.email,
    )
